import { AppCreator } from "../utils/App";
import { isEmpty, sleep } from "../utils/common";
import { CenturyAPIProvider } from "../utils/century.api.provider";
import { IDataFormExcel } from "../utils/types";
import { Page } from "puppeteer-core";
import { Workbook } from "exceljs";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import sanitize from "sanitize-filename";

if (typeof (XLSX as any).set_fs === 'function') {
    (XLSX as any).set_fs(fs);
}

function writeWorkbookSafely(wb: XLSX.WorkBook, filePath: string): void {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, fileBuffer);
}

function sameBookingKey(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** Reads the booking number currently shown in the page header (e.g. "ACC589N00929BD0"), or null. */
async function readBookingNumber(app: AppCreator): Promise<string | null> {
    try {
        const bookingText = await app.Page.$(
            '#page-content > quicknavigation-component > div > div > table > tbody > tr > td:nth-child(3) > span'
        );
        if (!bookingText) return null;
        const innerText = await bookingText.evaluate(el => el.textContent?.trim() ?? "");
        if (!innerText.includes(":")) return null;
        const value = innerText.split(":")[1]?.trim();
        return isEmpty(value) ? null : value.split(' ')[0];
    } catch {
        // Temporary evaluate errors while the page is transitioning
        return null;
    }
}

/**
 * Polls the page header until it shows `expectedKey`. Moving between bookings only
 * changes the URL hash, so the previous booking's header can stay on screen for a while.
 */
async function waitForBookingNumber(
    app: AppCreator,
    expectedKey: string,
    timeoutMs: number
): Promise<{ matched: boolean; lastSeen: string | null }> {
    const startTime = Date.now();
    let lastSeen: string | null = null;
    while (Date.now() - startTime < timeoutMs) {
        const current = await readBookingNumber(app);
        if (current) lastSeen = current;
        if (sameBookingKey(current, expectedKey)) {
            return { matched: true, lastSeen: current };
        }
        await sleep(1_000);
    }
    return { matched: false, lastSeen };
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

        try {
            await app.Page.goto(targetUrl, { waitUntil: 'load', timeout: 60_000 });
        } catch (gotoErr) {
            console.warn(`[openAndVerifyExistingBooking] Initial navigation warning:`, gotoErr);
        }

        // Wait for page action buttons or quick navigation to be visible
        let pageLoaded = false;
        try {
            await app.Page.waitForSelector('#page-content, #page-content-button-list, quicknavigation-component', {
                visible: true,
                timeout: 30_000
            });
            pageLoaded = true;
        } catch {
            console.log("[openAndVerifyExistingBooking] Initial wait timed out, reloading page...");
            try {
                await app.Page.reload({ waitUntil: 'load', timeout: 45_000 });
                await app.Page.waitForSelector('#page-content, #page-content-button-list, quicknavigation-component', {
                    visible: true,
                    timeout: 30_000
                });
                pageLoaded = true;
            } catch {
                pageLoaded = false;
            }
        }

        if (!pageLoaded) {
            // Check if redirected to login page or session expired
            const currentUrl = app.Page.url();
            const isLoginPage = currentUrl.includes('/login') || 
                                currentUrl.includes('Account/Login') || 
                                ((await app.Page.$('iframe').catch(() => null)) !== null && (await app.Page.$('#userIdAndSubgroup2').catch(() => null)) === null);

            if (isLoginPage) {
                return {
                    success: false,
                    ref: "#SESSION_EXPIRED",
                    message: "Century VMS session has expired or you have been logged out. Please restart and log in again."
                };
            }

            // Check if page displays an error message or alert banner
            const errorBanner = await app.Page.evaluate(() => {
                const el = document.querySelector('.alert-danger, .toast-error, .validation-summary-errors, .modal-content .text-danger');
                return el ? el.textContent?.trim() : null;
            }).catch(() => null);

            if (errorBanner) {
                return {
                    success: false,
                    ref: "#CENTURY_ERROR",
                    message: `Century VMS reported: ${errorBanner}`
                };
            }

            return {
                success: false,
                ref: "#PAGE_TIMEOUT",
                message: `Century VMS is taking too long to load. The site or your internet connection may be slow. (Booking: "${bookingKey}")`
            };
        }

        // Verify the page really shows the requested booking (not the previous one).
        let check = await waitForBookingNumber(app, bookingKey, 20_000);
        if (!check.matched) {
            console.log(`[openAndVerifyExistingBooking] Page shows "${check.lastSeen}" instead of "${bookingKey}", reloading...`);
            try {
                await app.Page.reload({ waitUntil: 'load', timeout: 45_000 });
            } catch (reloadErr) {
                console.warn(`[openAndVerifyExistingBooking] Reload warning:`, reloadErr);
            }
            check = await waitForBookingNumber(app, bookingKey, 30_000);
        }
        console.log(`[openAndVerifyExistingBooking] Live booking: "${check.lastSeen}", expected: "${bookingKey}", matched: ${check.matched}`);

        if (!check.matched) {
            const pageError = await app.Page.evaluate(() => {
                const errBanner = document.querySelector('.alert-danger, .toast-error, .validation-summary-errors');
                return errBanner ? errBanner.textContent?.trim() : null;
            }).catch(() => null);

            if (pageError) {
                return {
                    success: false,
                    ref: "#BOOKING_NOT_FOUND",
                    message: `Century VMS Error for Booking "${bookingKey}": ${pageError}`
                };
            }
            return {
                success: false,
                ref: "#BOOKING_MISMATCH",
                message: check.lastSeen
                    ? `Century VMS kept showing booking "${check.lastSeen}" instead of "${bookingKey}". Skipped to avoid saving files for the wrong booking.`
                    : `Booking "${bookingKey}" did not open in Century VMS. Check that the booking exists and the company code is correct.`
            };
        }

        return {
            success: true,
            ref: "#BOOKING_LOADED_OK",
            message: "OK",
            data: {
                companyCode,
                bookingKey
            }
        };

    } catch (error) {
        console.error('[openAndVerifyExistingBooking error]', error);
        let errorMsg = error instanceof Error ? error.message : "Unknown error while loading existing booking.";
        let refCode = '#0E0F00';
        if (errorMsg.toLowerCase().includes('timeout') || errorMsg.includes('waiting for selector')) {
            refCode = '#PAGE_TIMEOUT';
            errorMsg = `Century VMS is taking too long to load. The site or your internet connection may be slow. (Booking: "${bookingKey}")`;
        }
        return {
            success: false,
            ref: refCode,
            message: errorMsg
        };
    }
}

export type PoItemSource = 'export' | 'api' | 'page-fetch' | 'grid-api' | 'dom';

const PO_ITEM_PO_KEYS = ['PO #', 'PO No', 'PO Number', 'PO', 'po', 'poNo', 'po_no', 'po_number', 'PONumber', 'PoNo'];

/** Returns the PO number stored on a single PO item row, or ''. */
function getItemPo(itemRow: any): string {
    if (!itemRow || typeof itemRow !== 'object') return '';
    for (const key of PO_ITEM_PO_KEYS) {
        const val = itemRow[key];
        if (val !== undefined && val !== null && String(val).trim()) {
            return String(val).trim();
        }
    }
    return '';
}

async function openPoItemTab(app: AppCreator) {
    try {
        await app.Page.waitForSelector('li[id="#VobItemDetail"]', { timeout: 8_000 });
        const tabEl = await app.Page.$('li[id="#VobItemDetail"]');
        if (tabEl) {
            await tabEl.click();
        } else {
            await app.Page.evaluate(() => {
                const el = document.querySelector('li[id="#VobItemDetail"]') as HTMLElement;
                if (el) el.click();
            });
        }
    } catch {
        await app.Page.evaluate(() => {
            const el = document.querySelector('li[id="#VobItemDetail"]') as HTMLElement;
            if (el) el.click();
        }).catch(() => null);
    }
    await sleep(1500);

    // Wait for grid rows to render or loading spinner to finish
    try {
        await app.Page.waitForFunction(() => {
            const spinner = document.querySelector('grid-component span.ag-overlay-loading-center, .ag-overlay-loading-center');
            const rows = document.querySelectorAll('grid-component div.ag-row, div.ag-center-cols-container div.ag-row');
            const noRows = document.querySelector('.ag-overlay-no-rows-wrapper');
            return (!spinner || (spinner as HTMLElement).offsetParent === null) && (rows.length > 0 || !!noRows);
        }, { timeout: 15_000 });
    } catch {
        await sleep(2000);
    }
}

/** 1. Clicks the PO grid's own export button and parses the downloaded file. */
async function extractViaExportButton(app: AppCreator, downloadDir: string): Promise<any[] | null> {
    let client: Awaited<ReturnType<Page['createCDPSession']>> | null = null;
    try {
        client = await app.Page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadDir
        });

        // Only visible buttons inside a visible grid (the PO Item tab); never "Download Template".
        const exportBtnHandle = await app.Page.evaluateHandle(() => {
            const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
            const grids = Array.from(document.querySelectorAll('grid-component')).filter(isVisible);
            for (const grid of grids) {
                const btn = Array.from(grid.querySelectorAll('button')).filter(isVisible).find(b => {
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    const text = (b.textContent || '').toLowerCase();
                    const isExport = title.includes('export') || text.includes('export') || title.includes('excel') || text.includes('excel');
                    const isTemplate = title.includes('template') || text.includes('template');
                    return isExport && !isTemplate;
                });
                if (btn) return btn;
            }
            return null;
        });

        const exportButton = exportBtnHandle.asElement() as any;
        if (!exportButton) return null;

        console.log('[downloadPoItemFile] Found export button on PO items grid. Triggering browser export...');
        const filesBefore = new Set(fs.readdirSync(downloadDir));
        await exportButton.click();

        const pollStart = Date.now();
        while (Date.now() - pollStart < 15_000) {
            await sleep(1000);
            const newFiles = fs.readdirSync(downloadDir).filter(f =>
                !filesBefore.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp')
            );
            if (newFiles.length === 0) continue;

            const downloadedFile = path.join(downloadDir, newFiles[0]);
            try {
                const parsedWb = XLSX.read(fs.readFileSync(downloadedFile), { type: 'buffer' });
                const firstSheetName = parsedWb.SheetNames[0];
                if (firstSheetName && parsedWb.Sheets[firstSheetName]) {
                    const rows = XLSX.utils.sheet_to_json(parsedWb.Sheets[firstSheetName], { defval: '' });
                    if (Array.isArray(rows) && rows.length > 0) return rows;
                }
            } catch (parseErr) {
                console.warn('[downloadPoItemFile] Error parsing exported file:', parseErr);
            } finally {
                try { fs.unlinkSync(downloadedFile); } catch {}
            }
            return null;
        }
        return null;
    } catch (cdpErr) {
        console.log('[downloadPoItemFile] Browser export failed:', cdpErr);
        return null;
    } finally {
        if (client) {
            try { await client.detach(); } catch {}
        }
    }
}

/** 3. Calls the SearchBookingItem API from inside the logged-in page. */
async function extractViaPageFetch(app: AppCreator, bookingKey: string): Promise<any[] | null> {
    const apiItems = await app.Page.evaluate(async (bKey) => {
        try {
            const url = `/api/Vob/Vob/SearchBookingItem?formId=1000015&whereClause=%7B%7D&bookingKey=${encodeURIComponent(bKey)}&isLoadSizeData=false`;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return null;
            const json = await res.json();
            if (Array.isArray(json)) return json;
            if (Array.isArray(json.GridDataTable)) return json.GridDataTable;
            if (Array.isArray(json.ResultData)) return json.ResultData;
            if (Array.isArray(json.data)) return json.data;
            return null;
        } catch {
            return null;
        }
    }, bookingKey).catch(() => null);
    return Array.isArray(apiItems) && apiItems.length > 0 ? apiItems : null;
}

/** 4. Reads row data from the AG-Grid JavaScript API (all rows, not just the visible ones). */
async function extractViaGridApi(app: AppCreator): Promise<any[] | null> {
    const rows = await app.Page.evaluate(() => {
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const gridElements = Array.from(document.querySelectorAll('grid-component, ag-grid-angular, div.ag-root-wrapper, div.ag-root')).filter(isVisible);
        for (const el of gridElements) {
            const anyEl = el as any;
            const api = anyEl.__agGrid?.gridOptions?.api || anyEl.gridOptions?.api || anyEl.__agGridRecord?.gridOptions?.api;
            if (api && typeof api.forEachNode === 'function') {
                const out: any[] = [];
                api.forEachNode((node: any) => {
                    if (node && node.data) out.push(node.data);
                });
                if (out.length > 0) return out;
            }
        }
        return null;
    }).catch(() => null);
    return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

/**
 * 5. Last resort: reads the rendered grid cells. AG-Grid only renders visible rows/columns,
 * so this can be incomplete.
 */
async function extractViaDom(app: AppCreator): Promise<any[] | null> {
    const rows = await app.Page.evaluate(() => {
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const root = Array.from(document.querySelectorAll('div.ag-root-wrapper')).find(isVisible) || document;

        const headers: { colId: string; text: string }[] = [];
        root.querySelectorAll('div.ag-header-cell').forEach(cell => {
            const colId = cell.getAttribute('col-id') || cell.getAttribute('colid') || '';
            const text = cell.querySelector('.ag-header-cell-text')?.textContent?.trim() || cell.textContent?.trim() || '';
            if (colId && !colId.toLowerCase().includes('checkbox') && text && !headers.some(h => h.colId === colId)) {
                headers.push({ colId, text });
            }
        });

        // Rows are split across pinned/center containers; merge them by row-index.
        const byIndex = new Map<string, any>();
        root.querySelectorAll('div.ag-row').forEach(rowEl => {
            const idx = rowEl.getAttribute('row-index') || rowEl.getAttribute('row-id') || String(byIndex.size);
            const rowObj = byIndex.get(idx) || {};
            headers.forEach(h => {
                const cell = rowEl.querySelector(`div[col-id="${h.colId}"], div[colid="${h.colId}"]`);
                if (cell) rowObj[h.text || h.colId] = cell.textContent?.trim() || '';
            });
            byIndex.set(idx, rowObj);
        });

        return Array.from(byIndex.values()).filter(r => Object.values(r).some(v => v !== ''));
    }).catch(() => null);
    return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

async function downloadPoItemFile(
    app: AppCreator,
    bookingKey: string,
    downloadDir: string,
    saveIndividualFile: boolean = true,
    vmaApiProvider?: CenturyAPIProvider
): Promise<{ success: boolean; filePath?: string; rows?: any[]; source?: PoItemSource; partial?: boolean; message?: string }> {
    try {
        console.log(`[downloadPoItemFile] Opening PO Item tab for booking: ${bookingKey}`);
        await openPoItemTab(app);

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        let rows: any[] | null = null;
        let source: PoItemSource | undefined;

        // Sources in order of completeness; the rendered-cells fallback comes last.
        rows = await extractViaExportButton(app, downloadDir);
        if (rows) source = 'export';

        if (!rows && vmaApiProvider) {
            try {
                const apiRes = await vmaApiProvider.getAllBookingItems(bookingKey);
                if (apiRes.found && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
                    rows = apiRes.data;
                    source = 'api';
                }
            } catch (apiErr) {
                console.warn('[downloadPoItemFile] CenturyAPIProvider search item error:', apiErr);
            }
        }

        if (!rows) {
            rows = await extractViaPageFetch(app, bookingKey);
            if (rows) source = 'page-fetch';
        }

        if (!rows) {
            rows = await extractViaGridApi(app);
            if (rows) source = 'grid-api';
        }

        if (!rows) {
            rows = await extractViaDom(app);
            if (rows) source = 'dom';
        }

        if (!rows || !source) {
            return { success: false, message: 'PO Item grid was empty or could not be exported.' };
        }

        console.log(`[downloadPoItemFile] Got ${rows.length} PO item row(s) via ${source}.`);
        const partial = source === 'dom';

        const targetFilePath = path.join(downloadDir, `${sanitize(bookingKey)}_PO_Items.xlsx`);
        if (saveIndividualFile) {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PO Items');
            writeWorkbookSafely(wb, targetFilePath);
            console.log(`[downloadPoItemFile] Saved individual XLSX: ${targetFilePath} (${rows.length} rows)`);
        }
        return {
            success: true,
            filePath: saveIndividualFile ? targetFilePath : undefined,
            rows,
            source,
            partial
        };

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
    const combinePoItems = (app.initData.settings?.combinePoItems ?? (app.initData as any)?.combinePoItems) !== false;
    const keepIndividualFiles = (app.initData.settings?.keepIndividualFiles ?? (app.initData as any)?.keepIndividualFiles) === true;
    const downloadPdf = app.initData.settings?.downloadPdf !== false;
    const rawDownloadDir = (
        app.initData.settings?.downloadDir ||
        app.initData.downloadDir ||
        (app.initData.excelFile ? path.dirname(app.initData.excelFile) : '')
    ).trim();

    let downloadDir = path.join(os.homedir(), 'Downloads');
    if (rawDownloadDir) {
        try {
            if (!fs.existsSync(rawDownloadDir)) {
                fs.mkdirSync(rawDownloadDir, { recursive: true });
            }
            fs.accessSync(rawDownloadDir, fs.constants.W_OK);
            downloadDir = rawDownloadDir;
        } catch (dirErr) {
            console.warn(`[issueBooking] Warning: Configured downloadDir "${rawDownloadDir}" is inaccessible or invalid. Falling back to: "${downloadDir}"`, dirErr);
        }
    }

    console.log(`[issueBooking] Download Settings -> POItems: ${downloadPoItems}, Combine: ${combinePoItems}, KeepIndividual: ${keepIndividualFiles}, PDF: ${downloadPdf}, Dir: "${downloadDir}"`);

    // Master accumulator for combined PO Items across all bookings
    const combinedPoRows: any[] = [];
    const masterHeadersSet = new Set<string>(['Booking Number', 'PO Number']);
    let combinedBookingsCount = 0;
    // Where PO item rows came from; different sources use different column names.
    const poItemSources = new Set<PoItemSource>();

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
                const poNumber = (firstRow.po || '').trim();
                const bookingNumber = (firstRow.booking_number || (firstRow as any)['Booking Number'] || (firstRow as any)['Draft Booking No'] || '').trim();

                if (isEmpty(bookingNumber)) {
                    throw {
                        known: true,
                        ref: "#MISSING_BOOKING_NUMBER",
                        message: `Row group for PO "${poNumber || 'Unknown PO'}" is missing the required "Booking Number" in Excel.`
                    };
                }

                data.booking_number = bookingNumber;
                console.log(`\n========================================`);
                console.log(`[issueBooking] Processing Booking: ${bookingNumber} (PO: ${poNumber || '-'})`);
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

                // The page was verified to show exactly this booking; always use the requested key.
                const liveBookingKey = bookingNumber;
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
                    const saveIndiv = keepIndividualFiles || !combinePoItems;
                    const poItemRes = await downloadPoItemFile(app, liveBookingKey, downloadDir, saveIndiv, vmaApiProvider);
                    if (poItemRes.success) {
                        data.po_item_file = combinePoItems && !keepIndividualFiles ? "Combined" : "Downloaded";
                        downloadResults.push(combinePoItems && !keepIndividualFiles ? `PO Items: Combined` : `PO Items: Saved`);
                        if (poItemRes.partial) {
                            downloadResults.push(`Warning: PO items read from the screen, may be incomplete`);
                        }
                        if (poItemRes.source) poItemSources.add(poItemRes.source);

                        if (Array.isArray(poItemRes.rows) && poItemRes.rows.length > 0) {
                            // POs actually present on the booking (a booking can hold several POs).
                            const bookingPos = Array.from(new Set(poItemRes.rows.map(getItemPo).filter(Boolean)));
                            if (!poNumber && bookingPos.length > 0) {
                                firstRow.po = bookingPos.join(', ');
                            }

                            if (combinePoItems) {
                                combinedBookingsCount++;
                                for (const itemRow of poItemRes.rows) {
                                    // Each item row keeps its own PO; the Excel PO is only a fallback.
                                    const rowPo = getItemPo(itemRow) || poNumber;
                                    const rowObj: any = {
                                        'Booking Number': liveBookingKey,
                                        'PO Number': rowPo,
                                        ...itemRow
                                    };
                                    Object.keys(rowObj).forEach(k => masterHeadersSet.add(k));
                                    combinedPoRows.push(rowObj);
                                }
                                console.log(`[issueBooking] Accumulated ${poItemRes.rows.length} PO Item rows for Booking: ${liveBookingKey} (Total so far: ${combinedPoRows.length})`);
                            }
                        }
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
                        // Only the live booking status read from Century VMS; never a made-up value.
                        row.po_status = data.po_status || '';
                        row.booking_number = data.booking_number;
                        if (data.booking_created) row.booking_created = data.booking_created;
                        if (data.po_item_file) row.po_item_file = data.po_item_file;
                        if (data.pdf_file) row.pdf_file = data.pdf_file;
                        if (firstRow?.po && !row.po) {
                            row.po = firstRow.po;
                        }
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
            // A failed download is reported via Success/Message only; the booking status stays
            // whatever was read from Century VMS (or empty if the booking never loaded).
            if (Array.isArray(data.data)) {
                for (const row of data.data) {
                    row.po_status = data.po_status || '';
                    if (data.booking_number) row.booking_number = data.booking_number;
                    if (data.booking_created) row.booking_created = data.booking_created;
                    if (data.data[0]?.po && !row.po) {
                        row.po = data.data[0].po;
                    }
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

    // 5. Generate Single Combined Excel File if requested
    if (combinePoItems) {
        if (combinedPoRows.length > 0) {
            try {
                if (!fs.existsSync(downloadDir)) {
                    fs.mkdirSync(downloadDir, { recursive: true });
                }

                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
                const combinedFileName = `Combined_PO_Items_${dateStr}.xlsx`;
                const combinedFilePath = path.join(downloadDir, combinedFileName);

                const headersList = Array.from(masterHeadersSet);
                const ws = XLSX.utils.json_to_sheet(combinedPoRows, { header: headersList });

                // Auto-calculate column widths
                const colWidths = headersList.map(h => {
                    let max = h.length;
                    const sampleRows = combinedPoRows.slice(0, 100);
                    for (const r of sampleRows) {
                        const valLen = String(r[h] ?? '').length;
                        if (valLen > max) max = valLen;
                    }
                    return { wch: Math.min(Math.max(max + 3, 12), 40) };
                });
                ws['!cols'] = colWidths;

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'All PO Items');
                writeWorkbookSafely(wb, combinedFilePath);

                console.log(`[issueBooking] Successfully generated single combined PO Items file: ${combinedFilePath} (${combinedPoRows.length} rows across ${combinedBookingsCount} bookings)`);

                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'n',
                    title: 'Combined Excel File Created',
                    message: `Combined ${combinedPoRows.length} PO Item row(s) from ${combinedBookingsCount} booking(s) into single file:\n${combinedFileName}`
                }]);

                if (poItemSources.size > 1) {
                    await app.LocalCom.sendData(undefined, [{
                        channel: app.LocalCom.progress.channel,
                        type: 'w',
                        title: 'Mixed PO Item Sources',
                        message: `PO items were read in different ways (${Array.from(poItemSources).join(', ')}), so the combined file may contain differently named columns for some bookings.`
                    }]);
                }
            } catch (combErr) {
                console.error('[issueBooking] Error writing combined Excel file:', combErr);
                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'w',
                    title: 'Combined File Warning',
                    message: `Failed to create combined Excel file: ${combErr instanceof Error ? combErr.message : String(combErr)}`
                }]);
            }
        } else {
            console.warn('[issueBooking] combinePoItems was requested, but 0 PO Item rows were collected across all bookings.');
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'w',
                title: 'No PO Items to Combine',
                message: 'Combined Excel file was requested, but no PO Item rows were found across the processed bookings.'
            }]);
        }
    }
}