import { AppCreator } from "../utils/App";
import { sleep } from "../utils/common";
import { CenturyAPIProvider } from "../utils/century.api.provider";

export default async function pullBookingStatus(app: AppCreator) {
    try {
        console.log("[pullBookingStatus] Starting status pull process for ALL statuses...");
        app.LocalCom.progress.setTitleAndMessage(
            "Accessing VMS",
            "Navigating to Century VMS Booking Status layout..."
        );
        await app.LocalCom.sendData(undefined, [{
            channel: app.LocalCom.progress.channel,
            type: 'n',
            title: 'Starting Automation',
            message: 'Navigating to Century VMS Online Booking Status page...'
        }]);

        // Navigate to the online booking status page layout
        const targetPageUrl = "https://www.centuryvms.com/#/pagelayout?moduleCd=Vob&configName=VobVendorOnlineBookingStatusRtn";
        await app.Page.goto(targetPageUrl, { timeout: 60_000 });
        await sleep(15_000);
        await app.Page.reload({ waitUntil: "load" });
        await sleep(5_000);

        app.LocalCom.progress.setTitleAndMessage(
            "Extracting Token",
            "Creating API session from Century VMS authentication..."
        );
        await app.LocalCom.sendData(undefined, [{
            channel: app.LocalCom.progress.channel,
            type: 'n',
            title: 'Authentication',
            message: 'Century VMS authentication session extracted successfully.'
        }]);

        const axiosSession = await app.createSession();
        const apiProvider = new CenturyAPIProvider(axiosSession);

        // Fetch status summary counts
        app.LocalCom.progress.setTitleAndMessage(
            "Pulling Status Summary",
            "Requesting status overview counts from Century VMS API..."
        );
        await app.LocalCom.sendData();

        const summaryResult = await apiProvider.getOnlineBookingStatusSummary();
        let statusList: any[] = [];
        if (summaryResult.success && summaryResult.data?.GridDataTable) {
            statusList = summaryResult.data.GridDataTable;
            console.log(`[pullBookingStatus] Retrieved ${statusList.length} status summary categories`);
        } else {
            console.warn(`[pullBookingStatus] Failed to get status summary: ${summaryResult.message}`);
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'w',
                title: 'Status Summary Warning',
                message: `Failed to fetch status summary: ${summaryResult.message || 'Unknown error'}`
            }]);
            return;
        }

        if (statusList.length === 0) {
            app.LocalCom.progress.setTitleAndMessage("Completed", "No booking status categories found.");
            return;
        }

        // Calculate total expected bookings across all statuses for progress tracking
        const totalExpectedBookings = statusList.reduce((acc, it) => acc + (Number(it.status_count) || 0), 0);
        app.LocalCom.progress.setTotal(totalExpectedBookings > 0 ? totalExpectedBookings : statusList.length);
        console.log(`[pullBookingStatus] Total expected bookings across all categories: ${totalExpectedBookings}`);

        // Initialize work session so speed and remaining time can be tracked by TimerSection
        const sesResp = await app.LocalCom.progress.getNewSession(5, !app.LocalCom.CLIargs.devFlag);
        if (!sesResp.doNext) {
            app.LocalCom.progress.setTitleAndMessage("Stopped.", sesResp.message);
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'e',
                title: 'Stopped',
                message: sesResp.message || "Failed to initialize work session"
            }]);
            return;
        }

        // Send status summary payload to frontend along with info message
        await app.LocalCom.sendData([{
            _type: 'status_summary',
            token: app.century_bearer_token,
            data: statusList
        }], [{
            channel: app.LocalCom.progress.channel,
            type: 'n',
            title: 'Status Summary Loaded',
            message: `Retrieved ${statusList.length} categories with ${totalExpectedBookings} total bookings.`
        }]);

        let totalBookingsPulled = 0;
        let successfulStatuses = 0;
        const STREAM_CHUNK_SIZE = 30; // Progressive chunk size for real-time frontend streaming

        for (let i = 0; i < statusList.length; i++) {
            const item = statusList[i];
            const statusKey = item.status || item.Booking_Status;
            const expectedCount = Number(item.status_count) || 0;

            console.log(`[pullBookingStatus] [${i + 1}/${statusList.length}] Processing status "${statusKey}" (Expected: ${expectedCount})...`);

            app.LocalCom.progress.setTitleAndMessage(
                `Fetching Status (${i + 1}/${statusList.length})`,
                `Requesting "${statusKey}" from Century VMS (${expectedCount} records)...`
            );
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'n',
                title: `Fetching Status (${i + 1}/${statusList.length})`,
                message: `Requesting ${expectedCount} records for status "${statusKey}"...`
            }]);

            if (expectedCount === 0) {
                console.log(`[pullBookingStatus] Status "${statusKey}" has 0 records. Skipping grid fetch.`);
                await sleep(500);
                continue;
            }

            try {
                const gridResult = await apiProvider.getOnlineBookingStatusGrid(statusKey);
                if (gridResult.success && Array.isArray(gridResult.data?.GridDataTable)) {
                    const rawRows = gridResult.data.GridDataTable;
                    console.log(`[pullBookingStatus] Received ${rawRows.length} records for status "${statusKey}". Streaming to frontend...`);
                    totalBookingsPulled += rawRows.length;
                    successfulStatuses++;

                    if (rawRows.length > 0) {
                        const enrichedRows = rawRows.map((r: any, idx: number) => ({
                            ...r,
                            status: r.status || statusKey,
                            Booking_Status: r.Booking_Status || `${statusKey} Booking`,
                            booking_key: r.booking_key || r.booking_key_for_export || r.customer_booking_number || r.customBookingId || `BK_${statusKey}_${idx + 1}`,
                            rownum: r.rownum || (idx + 1)
                        }));

                        // Stream rows to frontend immediately in progressive chunks (like Booking Correction tab)
                        for (let cIdx = 0; cIdx < enrichedRows.length; cIdx += STREAM_CHUNK_SIZE) {
                            const chunk = enrichedRows.slice(cIdx, cIdx + STREAM_CHUNK_SIZE);
                            const currentSoFar = Math.min(cIdx + chunk.length, enrichedRows.length);

                            app.LocalCom.progress.setTitleAndMessage(
                                `Streaming: ${statusKey} (${i + 1}/${statusList.length})`,
                                `Streaming ${currentSoFar} of ${enrichedRows.length} "${statusKey}" bookings to table...`
                            );

                            // Send chunk immediately over IPC to frontend
                            await app.LocalCom.sendData(chunk);

                            // Register progress in real-time
                            const resp = await app.LocalCom.progress.registerSuccess(chunk.length);
                            if (resp && resp.continue === false) {
                                console.warn(`[pullBookingStatus] Streaming stopped by session controller: ${resp.message}`);
                                break;
                            }

                            // Brief micro-yield to allow UI event loop & IPC buffer to process smoothly
                            await sleep(20);
                        }

                        // Message upon finishing this status
                        await app.LocalCom.sendData(undefined, [{
                            channel: app.LocalCom.progress.channel,
                            type: 'n',
                            title: `Streamed: ${statusKey}`,
                            message: `Successfully streamed all ${rawRows.length} bookings for "${statusKey}".`
                        }]);
                    }
                } else {
                    console.warn(`[pullBookingStatus] Could not fetch grid for status "${statusKey}": ${gridResult.message}`);
                    await app.LocalCom.sendData(undefined, [{
                        channel: app.LocalCom.progress.channel,
                        type: 'w',
                        title: `Status: ${statusKey}`,
                        message: gridResult.message || `No records returned for status ${statusKey}`
                    }]);
                }
            } catch (statusErr: any) {
                console.error(`[pullBookingStatus] Error fetching status "${statusKey}":`, statusErr);
            }

            // Small pause between status requests to avoid rate limits
            await sleep(1000);
        }

        console.log(`[pullBookingStatus] Finished pulling all statuses. Total records: ${totalBookingsPulled}`);
        app.LocalCom.progress.setTitleAndMessage(
            "Completed",
            `Successfully processed all ${statusList.length} statuses. Pulled and streamed ${totalBookingsPulled} bookings.`
        );
        await app.LocalCom.sendData(undefined, [{
            channel: app.LocalCom.progress.channel,
            type: 'n',
            title: 'All Statuses Pulled',
            message: `Successfully streamed all ${statusList.length} status categories with a total of ${totalBookingsPulled} bookings to the table.`
        }]);

    } catch (err: any) {
        console.error("[pullBookingStatus] Unexpected error:", err);
        app.LocalCom.progress.setTitleAndMessage("Process Error", err?.message || String(err));
        await app.LocalCom.sendData(undefined, [{
            channel: app.LocalCom.progress.channel,
            type: 'e',
            title: 'Pull Status Error',
            message: err?.message || String(err)
        }]);
    }
}
