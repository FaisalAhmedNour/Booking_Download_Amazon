import { AppCreator } from "../utils/App";
import { isEmpty, sleep } from "../utils/common";
import { CenturyAPIProvider } from "../utils/century.api.provider";
import { VmsStatusStore } from "../utils/vmsStatusStore";
import { CombinedPoItemsWriter, formatDateColumns } from "../utils/combinedPoItemsWriter";
import { fetchPoItemsViaApi, ApiPoItemsResult, PO_ITEM_DATE_HEADERS } from "./poItemsApi";
import { fetchBookingHeaderViaApi, BookingHeaderResult } from "./bookingHeaderApi";
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

/** The booking's company code: the row's own, else the one in settings ("589 - ..." -> "589"). */
function resolveCompanyCode(app: AppCreator, customCompCd?: string): string {
    let companyCode = (customCompCd || '').trim();
    const settingsCode = app.initData?.settings?.companyCode;
    if (!companyCode && settingsCode) {
        companyCode = settingsCode.split('-')[0].trim();
    }
    return companyCode;
}

export async function openAndVerifyExistingBooking(app: AppCreator, bookingKey: string, customCompCd?: string) {
    try {
        const companyCode = resolveCompanyCode(app, customCompCd);

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

const PO_ITEM_PO_KEYS = ['PO #', 'PO No', 'PO Number', 'PO', 'po', 'poNo', 'po_no', 'po_number', 'PONumber', 'PoNo'];

/** Attempts per booking, and how long each attempt waits for Century VMS to send the export file. */
const PO_EXPORT_ATTEMPTS = 3;
/** Shown in the combined file's Bookings sheet for rows read from the API. */
const PO_SOURCE_API = 'Century API';
const PO_EXPORT_WAIT_MS = 45_000;

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

function clearDir(dir: string) {
    for (const f of fs.readdirSync(dir)) {
        try { fs.rmSync(path.join(dir, f), { recursive: true, force: true }); } catch { /* still being written; checked again later */ }
    }
}

/** Browser pages on which a pop-up was already closed; Century shows the alerts once per login. */
const popupClosedOn = new WeakSet<object>();

/**
 * Closes Century VMS pop-ups that cover the page (e.g. the "Administrative Alerts" notice
 * shown after login). While one is open, every click lands on it instead of the page.
 * After it has been closed once, later calls do nothing unless `force` is set (used when a
 * click did not work, in case a pop-up came back). Returns true if something was closed.
 */
export async function dismissPopups(app: AppCreator, force: boolean = false): Promise<boolean> {
    if (!force && popupClosedOn.has(app.Page)) return false;
    let closedAny = false;
    for (let round = 0; round < 3; round++) {
        const closed = await app.Page.evaluate(() => {
            const shown = (el: Element) => {
                const r = (el as HTMLElement).getBoundingClientRect();
                const cs = getComputedStyle(el as HTMLElement);
                return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
            };
            const containers = new Set<Element>(
                Array.from(document.querySelectorAll('.modal.show, .modal.in, .modal[style*="display: block"], [role="dialog"], .modal-dialog, .k-window, .ui-dialog'))
                    .filter(shown)
            );
            // The alerts box found by its title (<h4 class="modal-title"><span>Administrative Alerts</span></h4>).
            // Only its own dialog is searched, never the whole page (whose other "×" buttons, e.g.
            // Quick Search's clear button, must not be clicked).
            const title = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, span'))
                .find(e => e.children.length === 0 && /administrative alerts/i.test(e.textContent || '') && shown(e));
            const titleBox = title?.closest('.modal-content, .modal-dialog, .modal, [role="dialog"], [role="document"]');
            if (titleBox) containers.add(titleBox);

            const closeSelector = '[data-dismiss="modal"], [data-bs-dismiss="modal"], button.close, .close, [aria-label="Close"], .btn-close, '
                + '.k-window-action, .ui-dialog-titlebar-close, .fa-times, .fa-close, .fa-xmark, .glyphicon-remove';
            for (const c of Array.from(containers)) {
                const btn = Array.from(c.querySelectorAll(closeSelector)).find(shown)
                    || Array.from(c.querySelectorAll('button, a, span, i')).find(e => shown(e) && /^(×|✕|x|close)$/i.test((e.textContent || '').trim()));
                if (btn) {
                    (btn as HTMLElement).click();
                    return true;
                }
            }
            return false;
        }).catch(() => false);
        if (!closed) break;
        closedAny = true;
        console.log('[issueBooking] Closed a Century VMS pop-up covering the page.');
        await sleep(800);
    }
    if (closedAny) popupClosedOn.add(app.Page);
    return closedAny;
}

/**
 * True once the PO Items tab's content is on screen: any visible element whose id starts
 * with "VobItemDetail" (search form / grid of that tab), or the tab itself marked selected.
 * Content of inactive tabs stays in the DOM but hidden, so visibility is what counts.
 */
async function isPoItemTabActive(app: AppCreator): Promise<boolean> {
    return app.Page.evaluate(() => {
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        if (Array.from(document.querySelectorAll('[id^="VobItemDetail"]')).some(isVisible)) return true;
        const tab = document.querySelector('[data-uic-po-tab]');
        const li = tab?.closest('li');
        return (!!li && /\b(active|selected|k-state-active)\b/.test(li.className))
            || tab?.getAttribute('aria-selected') === 'true';
    }).catch(() => false);
}

/** Finds the PO Items tab and tags its clickable element with data-uic-po-tab. */
async function markPoItemTab(app: AppCreator): Promise<boolean> {
    return app.Page.evaluate(() => {
        document.querySelectorAll('[data-uic-po-tab]').forEach(e => e.removeAttribute('data-uic-po-tab'));
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const byId = ['li[id="#VobItemDetail"]', 'a[href="#VobItemDetail"]', '[aria-controls="VobItemDetail"]', '[data-target="#VobItemDetail"]']
            .map(s => document.querySelector(s))
            .find(e => !!e && isVisible(e));
        // Fallback: the tab's caption from the page config ("PO Items").
        const byText = Array.from(document.querySelectorAll('li, a, [role="tab"]'))
            .filter(isVisible)
            .find(e => (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'po items');
        const el = byId || byText;
        if (!el) return false;
        const target = el.tagName === 'LI' ? (el.querySelector('a') || el) : el;
        target.setAttribute('data-uic-po-tab', '1');
        return true;
    }).catch(() => false);
}

/** Opens the PO Items tab and waits for its grid. Returns false if the tab never opened. */
async function openPoItemTab(app: AppCreator): Promise<boolean> {
    // The workspace keeps re-rendering for a moment after the booking header appears;
    // a click made too early is lost and the page stays on "Booking Header".
    await sleep(2_000);
    let opened = await isPoItemTabActive(app);
    for (let attempt = 1; !opened && attempt <= 3; attempt++) {
        // The grid loads its rows from Vob/Vob/GetItemDetail when the tab opens.
        const itemsLoaded = app.Page.waitForResponse(r => /\/Vob\/GetItemDetail/i.test(r.url()), { timeout: 20_000 })
            .then(() => true)
            .catch(() => false);
        // First try: only if no pop-up was closed yet. Retries: check again, it may have come back.
        await dismissPopups(app, attempt > 1);
        if (await markPoItemTab(app)) {
            try {
                await app.Page.click('[data-uic-po-tab]');
            } catch {
                await app.Page.evaluate(() => (document.querySelector('[data-uic-po-tab]') as HTMLElement | null)?.click()).catch(() => null);
            }
        } else {
            console.log(`[downloadPoItemFile] PO Items tab not found on the page (attempt ${attempt}).`);
        }
        const deadline = Date.now() + 8_000;
        while (!opened && Date.now() < deadline) {
            await sleep(500);
            opened = await isPoItemTabActive(app);
        }
        if (opened) {
            await Promise.race([itemsLoaded, sleep(10_000)]);
            break;
        }
        console.log(`[downloadPoItemFile] PO Items tab did not open (attempt ${attempt}), retrying...`);
        await sleep(1500);
    }
    if (!opened) return false;

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
    return true;
}

/**
 * Finds the PO Items grid's "Export" button (the Excel icon, title="Export"). Only buttons inside
 * the PO Items tab count: another grid's button would export different data. The grid's
 * "Download" button is never used: it opens a "Please select a template" dialog, not an export.
 * Upload, template and SSCC buttons are never used either.
 */
async function findPoExportButton(app: AppCreator, timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const handle = await app.Page.evaluateHandle(() => {
            const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
            const describe = (b: Element) => [
                b.id, b.getAttribute('name'), b.getAttribute('title'), b.getAttribute('aria-label'), b.textContent,
            ].map(x => (x || '').toLowerCase()).join(' ');
            const scopes = Array.from(document.querySelectorAll('[id^="VobItemDetail"]')).filter(isVisible);
            const buttons = Array.from(new Set(scopes.flatMap(s =>
                Array.from(s.querySelectorAll('button, a.btn, [role="button"]'))
            ))).filter(isVisible);
            const usable = buttons.filter(b => !/template|upload|sscc|download/.test(describe(b)));
            return usable.find(b => (b.getAttribute('title') || '').trim().toLowerCase() === 'export')
                || usable.find(b => /export|excel/.test(describe(b)))
                || null;
        }).catch(() => null);
        const el = handle?.asElement();
        if (el) return el as any;
        await sleep(1000);
    }
    return null;
}

type PoExportResult =
    | { ok: true; rows: any[]; fileName: string }
    | { ok: false; message: string; retry: boolean };

/**
 * Reads the PO Items grid's total row count from its paging text ("1 to 50 of 76"),
 * or null if it is not shown.
 */
async function readPoGridTotal(app: AppCreator): Promise<number | null> {
    return app.Page.evaluate(() => {
        const scopes = Array.from(document.querySelectorAll('[id^="VobItemDetail"]'))
            .filter(el => (el as HTMLElement).offsetParent !== null);
        for (const s of scopes) {
            const panels = Array.from(s.querySelectorAll('.ag-paging-row-summary-panel'));
            for (const p of panels) {
                const m = (p.textContent || '').replace(/,/g, '').match(/of\s+(\d+)/i);
                if (m) return Number(m[1]);
            }
        }
        return null;
    }).catch(() => null);
}

/** Reads a booking key column from an exported row, if the export has one. */
function exportRowBookingKey(row: any): string {
    for (const k of Object.keys(row)) {
        if (/^booking[\s_#]*(key|no|number|#)?$/i.test(k.trim())) return String(row[k] ?? '').trim().toUpperCase();
    }
    return '';
}

/**
 * Clicks the PO Items grid's Export button and reads the file Century VMS sends.
 * Each click downloads into its own new folder, so a file left from an earlier booking is
 * never read. The file is accepted only if its row count matches the grid's total and,
 * when it has a booking key column, every row belongs to `bookingKey`.
 */
async function exportPoItems(app: AppCreator, bookingKey: string, exportDir: string): Promise<PoExportResult> {
    let client: Awaited<ReturnType<Page['createCDPSession']>> | null = null;
    let clickDir = '';
    try {
        const exportButton = await findPoExportButton(app, 15_000);
        if (!exportButton) {
            return { ok: false, retry: true, message: 'Export button of the PO Items grid was not found.' };
        }

        clearDir(exportDir);
        clickDir = fs.mkdtempSync(path.join(exportDir, 'export-'));
        client = await app.Page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: clickDir
        });

        const gridTotal = await readPoGridTotal(app);
        await dismissPopups(app);
        console.log(`[downloadPoItemFile] Clicking Export on the PO Items grid (grid shows ${gridTotal ?? 'unknown'} rows)...`);
        await exportButton.click();

        const expectedKey = bookingKey.trim().toUpperCase();
        const lastSizes = new Map<string, number>();
        const pollStart = Date.now();
        while (Date.now() - pollStart < PO_EXPORT_WAIT_MS) {
            await sleep(1000);
            for (const f of fs.readdirSync(clickDir)) {
                if (f.endsWith('.crdownload') || f.endsWith('.tmp')) continue;
                const fullPath = path.join(clickDir, f);

                // Read only once the file size has stopped changing.
                const size = fs.statSync(fullPath).size;
                if (size === 0 || lastSizes.get(f) !== size) {
                    lastSizes.set(f, size);
                    continue;
                }

                let rows: any[] = [];
                try {
                    const parsedWb = XLSX.read(fs.readFileSync(fullPath), { type: 'buffer' });
                    const firstSheetName = parsedWb.SheetNames[0];
                    if (firstSheetName && parsedWb.Sheets[firstSheetName]) {
                        rows = XLSX.utils.sheet_to_json(parsedWb.Sheets[firstSheetName], { defval: '' });
                    }
                } catch (parseErr: any) {
                    return { ok: false, retry: true, message: `Could not read the PO Items export "${f}": ${parseErr?.message || parseErr}` };
                } finally {
                    try { fs.unlinkSync(fullPath); } catch {}
                }

                if (rows.length === 0) {
                    return { ok: false, retry: false, message: 'The PO Items export from Century VMS has no rows.' };
                }
                const columns = Object.keys(rows[0]);
                // The grid has a pinned "Total" row; it may be exported too. Items always have a PO.
                const itemRows = rows.filter(r => getItemPo(r));
                if (itemRows.length > 0 && itemRows.length < rows.length) {
                    console.log(`[downloadPoItemFile] Dropped ${rows.length - itemRows.length} export row(s) without a PO # (e.g. the Total row).`);
                    rows = itemRows;
                }
                if (!PO_ITEM_PO_KEYS.some(k => columns.includes(k))) {
                    return {
                        ok: false,
                        retry: true,
                        message: `The PO Items export "${f}" has unexpected columns (${columns.slice(0, 5).join(', ')}...).`
                    };
                }
                const otherBooking = rows.map(exportRowBookingKey).find(k => k && k !== expectedKey);
                if (otherBooking) {
                    return { ok: false, retry: true, message: `The PO Items export "${f}" is for booking ${otherBooking}, not ${bookingKey}.` };
                }
                if (gridTotal !== null && rows.length !== gridTotal) {
                    return {
                        ok: false,
                        retry: true,
                        message: `The PO Items export "${f}" has ${rows.length} rows but the grid shows ${gridTotal}.`
                    };
                }
                return { ok: true, rows, fileName: f };
            }
        }
        return { ok: false, retry: true, message: `Century VMS did not send the PO Items export within ${PO_EXPORT_WAIT_MS / 1000} seconds.` };
    } catch (err: any) {
        return { ok: false, retry: true, message: `PO Items export failed: ${err?.message || err}` };
    } finally {
        if (client) {
            try { await client.detach(); } catch {}
        }
        if (clickDir) {
            try { fs.rmSync(clickDir, { recursive: true, force: true }); } catch {}
        }
    }
}

/** Saves one booking's PO item rows as "<booking>_PO_Items.xlsx" in `downloadDir`. */
function savePoItemsFile(rows: any[], bookingKey: string, downloadDir: string): string {
    const targetFilePath = path.join(downloadDir, `${sanitize(bookingKey)}_PO_Items.xlsx`);
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    formatDateColumns(ws, PO_ITEM_DATE_HEADERS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PO Items');
    writeWorkbookSafely(wb, targetFilePath);
    console.log(`[downloadPoItemFile] Saved individual XLSX: ${targetFilePath} (${rows.length} rows)`);
    return targetFilePath;
}

/**
 * Gets a booking's PO items. First from Century VMS's GetItemDetail API (the call the PO Items
 * grid itself uses), mapped to the grid export's columns; if that fails, from the grid's own
 * Export button. Both give the same columns in the same order, so the combined file stays
 * aligned whichever one is used. Other sources (SearchBookingItem, screen cells) are never used:
 * their columns and values differ.
 *
 * `options.useApi: false` skips the API (the comparison tool uses this to get the real export).
 */
export async function downloadPoItemFile(
    app: AppCreator,
    bookingKey: string,
    downloadDir: string,
    exportDir: string,
    saveIndividualFile: boolean = true,
    options: {
        compCd?: string;
        useApi?: boolean;
        /** Opens the booking page if it is not open yet; called only when the Export fallback is needed. */
        openBookingPage?: () => Promise<void>;
    } = {}
): Promise<{ success: boolean; filePath?: string; rows?: any[]; source?: string; message?: string }> {
    try {
        const finish = (rows: any[], source: string) => ({
            success: true,
            filePath: saveIndividualFile ? savePoItemsFile(rows, bookingKey, downloadDir) : undefined,
            rows,
            source,
        });

        let apiMessage = '';
        if (options.useApi !== false) {
            const apiStart = Date.now();
            const apiRes = await fetchPoItemsViaApi(app, bookingKey, (options.compCd || '').trim());
            if (apiRes.ok === true) {
                console.log(`[downloadPoItemFile] Got ${apiRes.rows.length} PO item row(s) from the Century VMS API in ${((Date.now() - apiStart) / 1000).toFixed(1)}s.`);
                return finish(apiRes.rows, PO_SOURCE_API);
            }
            apiMessage = (apiRes as Extract<ApiPoItemsResult, { ok: false }>).message;
            console.warn(`[downloadPoItemFile] ${apiMessage} Using the PO Items grid's Export button instead.`);
        }

        if (options.openBookingPage) {
            try {
                await options.openBookingPage();
            } catch (openErr: any) {
                const openMessage = openErr?.message || String(openErr);
                return { success: false, message: apiMessage ? `${apiMessage} ${openMessage}` : openMessage };
            }
        }

        let lastMessage = 'PO Items could not be exported.';
        for (let attempt = 1; attempt <= PO_EXPORT_ATTEMPTS; attempt++) {
            console.log(`[downloadPoItemFile] Booking ${bookingKey}: PO Items export attempt ${attempt}/${PO_EXPORT_ATTEMPTS}`);
            if (!(await openPoItemTab(app))) {
                lastMessage = 'The PO Items tab did not open in Century VMS.';
                console.warn(`[downloadPoItemFile] ${lastMessage}`);
                continue;
            }

            const res = await exportPoItems(app, bookingKey, exportDir);
            if (res.ok === false) {
                // (strict mode is off, so the union is not narrowed automatically)
                const fail = res as Extract<PoExportResult, { ok: false }>;
                lastMessage = fail.message;
                console.warn(`[downloadPoItemFile] Attempt ${attempt} failed: ${fail.message}`);
                if (!fail.retry) break;
                continue;
            }

            console.log(`[downloadPoItemFile] Got ${res.rows.length} PO item row(s) from "${res.fileName}".`);
            // The Bookings sheet shows why the API was not used.
            return finish(res.rows, `Grid export (${res.fileName})${apiMessage ? ` - API not used: ${apiMessage}` : ''}`);
        }
        return { success: false, message: apiMessage ? `${apiMessage} Export: ${lastMessage}` : lastMessage };
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
    const portalReady = await app.openPortalPage("https://www.centuryvms.com/#/pagelayout?moduleCd=Vob&configName=VobMain");
    if (!portalReady) {
        console.warn('[issueBooking] Century VMS access token not found; API fallbacks and PDF download may fail.');
    }

    const vmaApiProvider = new CenturyAPIProvider(await app.createSession());
    const statusStore = new VmsStatusStore(app);
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

    // Combined PO items file: rewritten after every booking so a stopped/killed run
    // still leaves a complete file with everything downloaded so far.
    const combinedWriter = (downloadPoItems && combinePoItems) ? new CombinedPoItemsWriter(downloadDir, new Date(), PO_ITEM_DATE_HEADERS) : null;
    let combinedAnnounced = false;
    let combinedLockWarned = false;
    let combinedErrorWarned = false;
    const saveCombinedFile = async () => {
        if (!combinedWriter || combinedWriter.rowCount === 0) return;
        const res = combinedWriter.save();
        if (res.ok) {
            if (!combinedAnnounced) {
                combinedAnnounced = true;
                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'n',
                    title: 'Combined Excel File',
                    message: `The combined PO Items file is updated after each booking:\n${res.filePath}`
                }]);
            }
            return;
        }
        console.warn(`[issueBooking] Combined file save failed (${res.locked ? 'locked' : 'error'}): ${res.error}`);
        if (res.locked && !combinedLockWarned) {
            combinedLockWarned = true;
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'w',
                title: 'Combined File Is Open',
                message: `Close "${combinedWriter.fileName}" in Excel; it will be updated after the next booking.`
            }]);
        } else if (!res.locked && !combinedErrorWarned) {
            combinedErrorWarned = true;
            await app.LocalCom.sendData(undefined, [{
                channel: app.LocalCom.progress.channel,
                type: 'w',
                title: 'Combined File Warning',
                message: `Could not update the combined Excel file: ${res.error}. Will retry after the next booking.`
            }]);
        }
    };
    // Private folder the browser saves PO Items exports into; the user's folder stays untouched.
    const poExportDir = downloadPoItems
        ? fs.mkdtempSync(path.join(os.tmpdir(), 'centuryvms-po-export-'))
        : '';
    let stoppedEarly = false;

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
        // For the combined file's 'Bookings' sheet
        let bookingPoItemRows = 0;
        let bookingPoSource: string | undefined;

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

                // 1. Booking status and created date: from the API; the booking page is opened
                //    only if the API fails (or later, if the PO Items API fails and the grid's
                //    Export button is needed). The page is verified to show exactly this booking.
                const rowCompCd = (firstRow as any)?.comp_cd || (firstRow as any)?.compCd;
                const companyCode = resolveCompanyCode(app, rowCompCd);
                let bookingPageOpen = false;
                const openBookingPage = async () => {
                    if (bookingPageOpen) return;
                    const verifyResp = await openAndVerifyExistingBooking(app, bookingNumber, rowCompCd);
                    if (!verifyResp.success) {
                        throw { known: true, ref: verifyResp.ref, message: verifyResp.message };
                    }
                    bookingPageOpen = true;
                };

                const liveBookingKey = bookingNumber;
                data.booking_number = liveBookingKey;

                const headerRes: BookingHeaderResult = await fetchBookingHeaderViaApi(app, liveBookingKey, companyCode);
                if (headerRes.ok === true) {
                    data.po_status = headerRes.status;
                    if (headerRes.created) data.booking_created = headerRes.created;
                    console.log(`[issueBooking] Booking ${liveBookingKey} (API): status "${headerRes.status}", created "${headerRes.created}"`);
                } else {
                    console.warn(`[issueBooking] ${(headerRes as Extract<BookingHeaderResult, { ok: false }>).message} Opening the booking page instead.`);
                    await openBookingPage();

                    const liveStatus = await getBookingStatusFromPage(app);
                    if (liveStatus) data.po_status = liveStatus;

                    const liveCreatedDate = await getBookingCreatedDateFromPage(app);
                    if (liveCreatedDate) data.booking_created = liveCreatedDate;
                }

                const downloadResults: string[] = [];
                let poItemSuccess = true;
                let pdfSuccess = true;

                // 2. Download PO Item files if requested
                if (downloadPoItems) {
                    const saveIndiv = keepIndividualFiles || !combinePoItems;
                    const poItemRes = await downloadPoItemFile(app, liveBookingKey, downloadDir, poExportDir, saveIndiv, {
                        compCd: companyCode,
                        openBookingPage,
                    });
                    if (poItemRes.success) {
                        data.po_item_file = combinePoItems && !keepIndividualFiles ? "Combined" : "Downloaded";
                        downloadResults.push(combinePoItems && !keepIndividualFiles ? `PO Items: Combined` : `PO Items: Saved`);
                        bookingPoSource = poItemRes.source;

                        if (Array.isArray(poItemRes.rows) && poItemRes.rows.length > 0) {
                            bookingPoItemRows = poItemRes.rows.length;
                            // POs actually present on the booking (a booking can hold several POs).
                            const bookingPos = Array.from(new Set(poItemRes.rows.map(getItemPo).filter(Boolean)));
                            if (!poNumber && bookingPos.length > 0) {
                                firstRow.po = bookingPos.join(', ');
                            }

                            if (combinedWriter) {
                                // Each item row keeps its own PO; the Excel PO is only a fallback.
                                combinedWriter.addPoItemRows(poItemRes.rows.map((itemRow: any) => ({
                                    'Booking Number': liveBookingKey,
                                    'PO Number': getItemPo(itemRow) || poNumber,
                                    ...itemRow
                                })));
                                console.log(`[issueBooking] Accumulated ${poItemRes.rows.length} PO Item rows for Booking: ${liveBookingKey} (Total so far: ${combinedWriter.rowCount})`);
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
                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'e',
                    title: `Booking: ${data.booking_number || poTitle}`,
                    message: `Booking ${data.booking_number || poTitle} download failed: \n ${data.Message}`
                }]);
                resp = await app.LocalCom.progress.registerFail(1);
            }

            await app.LocalCom.sendData([data]);

            // Remember the result on the saved VMS status row (ignored if the booking was never pulled).
            if (data.booking_number) {
                await statusStore.saveDownloadResult(data.booking_number, {
                    poItemFile: data.po_item_file,
                    pdfFile: data.pdf_file,
                    downloadSuccess: data.Success,
                    downloadMessage: data.Message,
                });
            }

            // Write the combined file now, so it is complete up to this booking even if the run is killed.
            if (combinedWriter) {
                const bookingKeyForSheet = data.booking_number || (data.data?.[0]?.po ? `(PO ${data.data[0].po})` : '');
                if (bookingKeyForSheet) {
                    combinedWriter.recordBooking({
                        bookingKey: bookingKeyForSheet,
                        po: data.data?.[0]?.po,
                        success: data.Success,
                        poItemRows: bookingPoItemRows,
                        source: bookingPoSource,
                        message: data.Message,
                    });
                }
                await saveCombinedFile();
            }

            if (!resp.continue) {
                stoppedEarly = true;
                app.LocalCom.progress.setTitleAndMessage("Stopped.", resp.message);
                await app.LocalCom.sendData(undefined, [
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

    // Report the last (< buffer size) success/fail counts that are still buffered.
    try {
        await app.LocalCom.progress.flushBuffer();
    } catch (flushErr) {
        console.warn('[issueBooking] Failed to flush progress buffer:', flushErr);
    }

    if (poExportDir) {
        try { fs.rmSync(poExportDir, { recursive: true, force: true }); } catch { /* temp folder, harmless */ }
    }

    // 5. Final save of the combined Excel file (it was already updated after each booking)
    if (combinedWriter) {
        if (combinedWriter.rowCount > 0) {
            const res = combinedWriter.saveFinal();
            const totalBookings = app.dateManager.length;
            const included = combinedWriter.bookingsWithItems;
            if (res.ok) {
                console.log(`[issueBooking] Combined PO Items file saved: ${res.filePath} (${combinedWriter.rowCount} rows across ${included} bookings)`);
                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'n',
                    title: 'Combined Excel File Created',
                    message: `Combined ${combinedWriter.rowCount} PO Item row(s) from ${included} booking(s)` +
                        (stoppedEarly ? ` (run stopped early; ${totalBookings} booking(s) were selected)` : '') +
                        ` into single file:\n${res.filePath}`
                }]);
            } else {
                console.error('[issueBooking] Error writing combined Excel file:', res.error);
                await app.LocalCom.sendData(undefined, [{
                    channel: app.LocalCom.progress.channel,
                    type: 'w',
                    title: 'Combined File Warning',
                    message: `Failed to save the combined Excel file: ${res.error}` +
                        (combinedAnnounced ? `\nThe last saved version is in:\n${combinedWriter.filePath}` : '')
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
