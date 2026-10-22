import { AppCreator } from "../utils/App";
import { isEmpty, sleep } from "../utils/common";
import { CenturyAPIProvider } from "../utils/century.api.provider";
import { IDataFormExcel } from "../utils/types";
import { Page } from "puppeteer-core";
import { Workbook } from "exceljs";
import * as fs from "fs";
import * as path from "path";
import sanitize from "sanitize-filename";

async function getBookingNumber(app: AppCreator): Promise<string | null> {
    const startTime = Date.now();
    const timeout = 30_000;

    while (Date.now() - startTime < timeout) {
        try {
            const bookingText = await app.Page.$(
                '#page-content > quicknavigation-component > div > div > table > tbody > tr > td:nth-child(3) > span'
            );

            if (bookingText) {
                const innerText = await bookingText.evaluate(
                    el => el.textContent?.trim() ?? ""
                );

                if (innerText.includes(":")) {
                    const value = innerText.split(":")[1]?.trim();
                    if (!isEmpty(value)) {
                        return value.trim().split(' ')[0];
                    }
                }
            }
        } catch {
            // Ignore temporary evaluate errors while page is transitioning
        }
        await sleep(1_500);
    }
    return null;
}

async function getBookingStatusFromPage(app: AppCreator): Promise<string | null> {
    try {
        const startTime = Date.now();
        const timeout = 10_000;
        while (Date.now() - startTime < timeout) {
            const statusEle = await app.Page.$(
                '#page-content > quicknavigation-component > div > div > table > tbody > tr > td:nth-child(1) > span'
            );
            if (statusEle) {
                const statusText = await statusEle.evaluate(el => el.textContent?.trim() ?? "");
                if (statusText.includes(":")) {
                    const value = statusText.split(":")[1]?.trim();
                    if (!isEmpty(value)) return value;
                }
            }
            await sleep(1_000);
        }
    } catch {
        // Fallback gracefully
    }
    return null;
}

async function getBookingCreatedDateFromPage(app: AppCreator): Promise<string | null> {
    try {
        const startTime = Date.now();
        const timeout = 10_000;
        while (Date.now() - startTime < timeout) {
            const createdEle = await app.Page.$(
                '#page-content > quicknavigation-component > div > div > table > tbody > tr > td:nth-child(2) > span'
            );
            if (createdEle) {
                const text = await createdEle.evaluate(el => el.textContent?.trim() ?? "");
                if (text.includes(":")) {
                    const value = text.split(":")[1]?.trim();
                    if (!isEmpty(value)) return value;
                }
            }
            await sleep(1_000);
        }
    } catch {
        // Fallback gracefully
    }
    return null;
}

async function openAndVerifyExistingBooking(app: AppCreator, bookingKey: string, customCompCd?: string) {
    try {
        const commonData = app.initData.settings;
        let companyCode = (customCompCd || '').trim();
        if (!companyCode && commonData && commonData.companyCode) {
            companyCode = commonData.companyCode.split('-')[0].trim();
        }

        if (!companyCode) {
            return {
                success: false,
                ref: "#E10001",
                message: "Company Code is missing in settings."
            };
        }

        const targetUrl = `https://www.centuryvms.com/#/pagelayout?modulecd=Vob&configName=VobWorkspace&bookingKey=${encodeURIComponent(bookingKey)}&compCd=${companyCode}`;
        console.log(`[openAndVerifyExistingBooking] Navigating to: ${targetUrl}`);

        await app.Page.goto(targetUrl, { waitUntil: 'load', timeout: 60_000 });

        // Wait for page action buttons or quick navigation to be visible
        try {
            await app.Page.waitForSelector('#page-content, #page-content-button-list, quicknavigation-component', {
                visible: true,
                timeout: 30_000
            });
        } catch {
            console.log("[openAndVerifyExistingBooking] Initial wait timed out, reloading page...");
            await app.Page.reload({ waitUntil: 'load' });
            await app.Page.waitForSelector('#page-content, #page-content-button-list, quicknavigation-component', {
                visible: true,
                timeout: 30_000
            });
        }

        await sleep(2_000);

        // Verify booking loaded
        const liveBookingNumber = await getBookingNumber(app);
        console.log(`[openAndVerifyExistingBooking] Live booking detected: "${liveBookingNumber}", expected: "${bookingKey}"`);

        // Check if page displays an error message or alert
        const pageError = await app.Page.evaluate(() => {
            const errBanner = document.querySelector('.alert-danger, .toast-error, .validation-summary-errors');
            return errBanner ? errBanner.textContent?.trim() : null;
        }).catch(() => null);

        if (pageError && !liveBookingNumber) {
            return {
                success: false,
                ref: "#BOOKING_NOT_FOUND",
                message: `Century VMS Error for Booking "${bookingKey}": ${pageError}`
            };
        }

        return {
            success: true,
            ref: "#BOOKING_LOADED_OK",
            message: "OK",
            data: {
                companyCode,
                bookingKey: liveBookingNumber || bookingKey
            }
        };

    } catch (error) {
        console.error('[openAndVerifyExistingBooking error]', error);
        return {
            success: false,
            ref: '#0E0F00',
            message: error instanceof Error ? error.message : "Unknown error while loading existing booking."
        };
    }
}

async function downloadPoItemFile(app: AppCreator, bookingKey: string, downloadDir: string): Promise<{ success: boolean; filePath?: string; message?: string }> {
    try {
        console.log(`[downloadPoItemFile] Opening PO Item tab for booking: ${bookingKey}`);
        await app.Page.waitForSelector('li[id="#VobItemDetail"]', { timeout: 25_000 });
        await app.Page.click('li[id="#VobItemDetail"]');

        // Wait for grid or loading spinner to finish
        await sleep(2_000);
        try {
            await app.Page.waitForSelector('grid-component span.ag-overlay-loading-center', { hidden: true, timeout: 20_000 });
        } catch {}

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const safeKey = sanitize(bookingKey);
        const targetFileName = `${safeKey}_PO_Items.xlsx`;
        const targetFilePath = path.join(downloadDir, targetFileName);

        let downloaded = false;

        // 1. Try browser export via CDP download interception
        try {
            const client = await app.Page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadDir
            });

            const exportBtnSelector = 'grid-component button[title*="Export"], grid-component button[title*="Excel"], button[title*="Export to Excel"], button[title*="Export"], button[title*="Download Template"]';
            const exportButton = await app.Page.$(exportBtnSelector);

            if (exportButton) {
                console.log('[downloadPoItemFile] Found export button on PO items grid. Triggering download...');
                const filesBefore = new Set(fs.readdirSync(downloadDir));
                await exportButton.click();

                const pollStart = Date.now();
                while (Date.now() - pollStart < 15_000) {
                    await sleep(1_000);
                    const filesAfter = fs.readdirSync(downloadDir);
                    const newFiles = filesAfter.filter(f => !filesBefore.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
                    if (newFiles.length > 0) {
                        const downloadedFile = path.join(downloadDir, newFiles[0]);
                        if (fs.existsSync(targetFilePath) && targetFilePath !== downloadedFile) {
                            try { fs.unlinkSync(targetFilePath); } catch {}
                        }
                        fs.renameSync(downloadedFile, targetFilePath);
                        downloaded = true;
                        console.log(`[downloadPoItemFile] Successfully captured exported file: ${targetFilePath}`);
                        break;
                    }
                }
            }
        } catch (cdpErr) {
            console.log('[downloadPoItemFile] Browser export trigger info:', cdpErr);
        }

        // 2. Fallback: Extract live table rows from Ag-Grid DOM and write clean Excel file
        if (!downloaded) {
            console.log('[downloadPoItemFile] Browser export did not produce a file, extracting grid data directly...');
            const gridData = await app.Page.evaluate(() => {
                // Check if AgGrid instance is accessible via DOM
                const gridElement = document.querySelector('grid-component, div.ag-root') as any;
                if (gridElement && gridElement.__agGrid && gridElement.__agGrid.gridOptions) {
                    const api = gridElement.__agGrid.gridOptions.api;
                    if (api) {
                        const rows: any[] = [];
                        api.forEachNode((node: any) => {
                            if (node && node.data) rows.push(node.data);
                        });
                        if (rows.length > 0) return { source: 'api', rows };
                    }
                }

                // Extract headers and cells from AgGrid DOM
                const headerCells = document.querySelectorAll('div.ag-header-cell');
                const headers: { colId: string; text: string }[] = [];
                headerCells.forEach(cell => {
                    const colId = cell.getAttribute('col-id') || cell.getAttribute('colid') || '';
                    const text = cell.querySelector('.ag-header-cell-text')?.textContent?.trim() || cell.textContent?.trim() || '';
                    if (colId && !colId.toLowerCase().includes('checkbox') && text) {
                        headers.push({ colId, text });
                    }
                });

                const rowElements = document.querySelectorAll('div.ag-body-container div.ag-row, div.ag-center-cols-container div.ag-row');
                const rows: any[] = [];
                rowElements.forEach(rowEl => {
                    const rowObj: any = {};
                    headers.forEach(h => {
                        const cell = rowEl.querySelector(`div[col-id="${h.colId}"], div[colid="${h.colId}"]`);
                        rowObj[h.text || h.colId] = cell?.textContent?.trim() || '';
                    });
                    if (Object.keys(rowObj).length > 0 && Object.values(rowObj).some(v => v !== '')) {
                        rows.push(rowObj);
                    }
                });

                return { source: 'dom', headers: headers.map(h => h.text || h.colId), rows };
            });

            if (gridData && gridData.rows && gridData.rows.length > 0) {
                const workbook = new Workbook();
                const sheet = workbook.addWorksheet('PO Items');

                const sampleRow = gridData.rows[0];
                const columns = Object.keys(sampleRow).map(k => ({
                    header: k,
                    key: k,
                    width: Math.max(k.length + 4, 15)
                }));
                sheet.columns = columns;

                gridData.rows.forEach((r: any) => sheet.addRow(r));
                await workbook.xlsx.writeFile(targetFilePath);
                downloaded = true;
                console.log(`[downloadPoItemFile] Fallback extracted ${gridData.rows.length} row(s) to ${targetFilePath}`);
            }
        }

        if (downloaded && fs.existsSync(targetFilePath)) {
            return { success: true, filePath: targetFilePath };
        } else {
            return { success: false, message: 'PO Item grid was empty or could not be exported.' };
        }

    } catch (err: any) {
        console.error('[downloadPoItemFile error]', err);
        return { success: false, message: err?.message || String(err) };
    }
}

async function downloadBookingPdf(app: AppCreator, apiProvider: CenturyAPIProvider, bookingKey: string, downloadDir: string): Promise<{ success: boolean; filePath?: string; message?: string }> {
    let reportPage: Page | null = null;
    try {
        console.log(`[downloadBookingPdf] Fetching Booking Confirmation PDF for: ${bookingKey}`);
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const safeKey = sanitize(bookingKey);
        const targetFileName = `${safeKey}_BookingConfirmation.pdf`;
        const targetFilePath = path.join(downloadDir, targetFileName);

        // Open in a new page/tab to not disturb current booking workspace
        reportPage = await app.Browser.newPage();
        const bs64 = await apiProvider.downloadPDF(reportPage, bookingKey);
        if (bs64) {
            const pdfBuffer = Buffer.from(bs64, 'base64');
            fs.writeFileSync(targetFilePath, new Uint8Array(pdfBuffer));
            console.log(`[downloadBookingPdf] Successfully saved PDF: ${targetFilePath}`);
            return { success: true, filePath: targetFilePath };
        } else {
            return { success: false, message: 'Century VMS returned empty PDF data.' };
        }
    } catch (err: any) {
        console.error('[downloadBookingPdf error]', err);
        return { success: false, message: err?.message || String(err) };
    } finally {
        if (reportPage) {
            try {
                await reportPage.close();
            } catch {}
        }
    }
}

export default async function issueBooking(app: AppCreator) {
    await app.Page.goto("https://www.centuryvms.com/#/pagelayout?moduleCd=Vob&configName=VobMain", { timeout: 60_000 });
    await sleep(25_000);
    await app.Page.reload({ waitUntil: "load" });

    const vmaApiProvider = new CenturyAPIProvider(await app.createSession());
    app?.LocalCom?.progress?.setTotal(app.dateManager.length);

    const sesResp = await app.LocalCom.progress.getNewSession(5, !app.LocalCom.CLIargs.devFlag);
    if (!sesResp.doNext) {
        app.LocalCom.progress.setTitleAndMessage("Stopped.", sesResp.message);
        await app.LocalCom.sendData(undefined, [
            {
                channel: app.LocalCom.progress.channel,
                type: 'e',
                title: 'Stopped.',
                message: sesResp.message || "#88388484"
            }
        ]);
        return;
    }

    // Resolve download options
    const downloadPoItems = app.initData.settings?.downloadPoItems !== false;
    const downloadPdf = app.initData.settings?.downloadPdf !== false;
    const downloadDir = (
        app.initData.settings?.downloadDir ||
        app.initData.downloadDir ||
        (app.initData.excelFile ? path.dirname(app.initData.excelFile) : process.cwd())
    ).trim();

    console.log(`[issueBooking] Download Settings -> POItems: ${downloadPoItems}, PDF: ${downloadPdf}, Dir: "${downloadDir}"`);

    app.LocalCom.progress.setTitleAndMessage('Booking Download', 'Downloading booking files from Century VMS.');
    app.LocalCom.sendData();

    while (app.dateManager.haveNext()) {
        let data: {
            Success: boolean;
            Message: string;
            data: IDataFormExcel[];
            booking_number?: string;
            booking_created?: string;
            po_status?: string;
            po_item_file?: string;
            pdf_file?: string;
        } = {
            Success: false,
            Message: "",
            data: [],
            booking_number: undefined,
            booking_created: undefined,
            po_status: undefined,
            po_item_file: undefined,
            pdf_file: undefined,
        };

        try {
            const _data = app.dateManager.getData();
            if (_data && _data.length > 0) {
                data.data = _data;
            }

            if (isEmpty(data.data) || data.data.length === 0) {
                data.Message = "No row data found for this group.";
            } else {
                const firstRow = data.data[0];
                const poNumber = firstRow.po || "Unknown PO";
                const bookingNumber = (firstRow.booking_number || (firstRow as any)['Booking Number'] || (firstRow as any)['Draft Booking No'] || '').trim();

                if (isEmpty(bookingNumber)) {
                    throw {
                        known: true,
                        ref: "#MISSING_BOOKING_NUMBER",
                        message: `Row group for PO "${poNumber}" is missing the required "Booking Number" in Excel.`
                    };
                }

                data.booking_number = bookingNumber;
                console.log(`\n========================================`);
                console.log(`[issueBooking] Processing Booking: ${bookingNumber} (PO: ${poNumber})`);
                console.log(`========================================`);

                // 1. Open and verify booking in Century VMS
                const rowCompCd = (firstRow as any)?.comp_cd || (firstRow as any)?.compCd;
                const verifyResp = await openAndVerifyExistingBooking(app, bookingNumber, rowCompCd);

                if (!verifyResp.success) {
                    throw {
                        known: true,
                        ref: verifyResp.ref,
                        message: verifyResp.message
                    };
                }

                const liveBookingKey = verifyResp.data?.bookingKey || bookingNumber;
                data.booking_number = liveBookingKey;

                const liveStatus = await getBookingStatusFromPage(app);
                if (liveStatus) data.po_status = liveStatus;

                const liveCreatedDate = await getBookingCreatedDateFromPage(app);
                if (liveCreatedDate) data.booking_created = liveCreatedDate;

                const downloadResults: string[] = [];
                let poItemSuccess = true;
                let pdfSuccess = true;

                // 2. Download PO Item files if requested
                if (downloadPoItems) {
                    const poItemRes = await downloadPoItemFile(app, liveBookingKey, downloadDir);
                    if (poItemRes.success) {
                        data.po_item_file = "Downloaded";
                        downloadResults.push(`PO Items: Saved`);
                    } else {
                        data.po_item_file = "Failed";
                        poItemSuccess = false;
                        downloadResults.push(`PO Items: ${poItemRes.message || 'Failed'}`);
                    }
                } else {
                    data.po_item_file = "Skipped";
                }

                // 3. Download Booking Confirmation PDF if requested
                if (downloadPdf) {
                    const pdfRes = await downloadBookingPdf(app, vmaApiProvider, liveBookingKey, downloadDir);
                    if (pdfRes.success) {
                        data.pdf_file = "Downloaded";
                        downloadResults.push(`PDF: Saved`);
                    } else {
                        data.pdf_file = "Failed";
                        pdfSuccess = false;
                        downloadResults.push(`PDF: ${pdfRes.message || 'Failed'}`);
                    }
                } else {
                    data.pdf_file = "Skipped";
                }

                // 4. Overall result evaluation
                const allSelectedSuccess = (downloadPoItems ? poItemSuccess : true) && (downloadPdf ? pdfSuccess : true);
                if (allSelectedSuccess) {
                    data.Success = true;
                    data.Message = downloadResults.join(' | ') || "Download Successful";
                } else {
                    data.Success = false;
                    data.Message = downloadResults.join(' | ') || "Download Failed";
                }

                // Propagate values to all rows for UI table
                if (Array.isArray(data.data)) {
                    for (const row of data.data) {
                        row.po_status = data.po_status || "Completed";
                        row.booking_number = data.booking_number;
                        if (data.booking_created) row.booking_created = data.booking_created;
                        if (data.po_item_file) row.po_item_file = data.po_item_file;
                        if (data.pdf_file) row.pdf_file = data.pdf_file;
                        row.Success = data.Success;
                        row.Message = data.Message;
                    }
                }
            }

        } catch (e: any) {
            data.Success = false;
            if (e && typeof e === 'object' && e.known === true) {
                data.Message = e.message || '';
            } else if (e instanceof Error) {
                data.Message = e.message;
            } else {
                data.Message = String(e || 'Unknown error occurred.');
            }
            data.po_status = "Failed";
            if (Array.isArray(data.data)) {
                for (const row of data.data) {
                    row.po_status = "Failed";
                    if (data.booking_number) row.booking_number = data.booking_number;
                    if (data.booking_created) row.booking_created = data.booking_created;
                    row.Success = false;
                    row.Message = data.Message;
                }
            }
        } finally {
            let resp: { continue: boolean; message: string | undefined };
            const poTitle = (data.data && data.data[0] && data.data[0].po) ? data.data[0].po : (data.booking_number || "Unknown");

            if (data.Success) {
                resp = await app.LocalCom.progress.registerSuccess(1);
            } else {
                app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'e',
                    title: `Booking: ${data.booking_number || poTitle}`,
                    message: `Booking ${data.booking_number || poTitle} download failed: \n ${data.Message}`
                }]);
                resp = await app.LocalCom.progress.registerFail(1);
            }

            await app.LocalCom.sendData([data]);

            if (!resp.continue) {
                app.LocalCom.progress.setTitleAndMessage("Stopped.", resp.message);
                app.LocalCom.sendData(undefined, [
                    {
                        channel: app.LocalCom.progress.channel,
                        type: 'e',
                        title: 'Stopped.',
                        message: resp.message || "#33017223"
                    }
                ]);
                break;
            }

            app.dateManager.next();
        }
    }
}