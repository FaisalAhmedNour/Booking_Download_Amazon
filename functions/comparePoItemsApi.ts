/**
 * Dev tool: for a few bookings, gets the PO items both ways (the grid's Export file and the
 * SearchBookingItem API), works out which API field feeds each export column, and compares
 * every cell. Tells us whether the API alone can replace the export without changing data.
 *
 * Output: <downloadDir>/PO_Items_API_Comparison_<time>/ with report.xlsx and the raw
 * API / config / network responses for inspection.
 */
import { AppCreator } from "../utils/App";
import { CenturyAPIProvider } from "../utils/century.api.provider";
import { openAndVerifyExistingBooking, downloadPoItemFile } from "./issueBooking";
import { HTTPResponse } from "puppeteer-core";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import sanitize from "sanitize-filename";

type MappedBy = 'grid-header' | 'page-config' | 'values' | 'values-partial';

type ColumnResult = {
    exportColumn: string;
    apiField?: string;
    mappedBy?: MappedBy;
    /** 'match' | 'match-blank' (both empty, so unverified) | 'mismatch' | 'no-field' */
    status: 'match' | 'match-blank' | 'mismatch' | 'no-field';
    cellsCompared: number;
    cellsDifferent: number;
    example?: string;
};

type BookingComparison = {
    bookingKey: string;
    /** Which API the download was compared with. */
    api: string;
    apiNote?: string;
    error?: string;
    exportRows: number;
    apiRows: number;
    pageOpenSec: number;
    exportSec: number;
    apiSec: number;
    rowAlignment: string;
    columns: ColumnResult[];
    unusedApiFields: { field: string; sample: string }[];
};

const KEY_COLUMNS = ['PO #', 'ASIN #', 'Model #'];
const NETWORK_URL_PATTERN = /BookingItem|ItemDetail|PageLayout|\/ple\/Grid/i;

// ---------- value normalisation ----------

function excelSerialToIso(n: number): string {
    return new Date(Math.round((n - 25569) * 86_400_000)).toISOString().slice(0, 10);
}

/** yyyy-mm-dd if the value looks like a date (ISO, /Date(ms)/, m/d/yyyy, Excel serial), else null. */
function asDate(v: unknown, allowSerial: boolean): string | null {
    if (typeof v === 'number') {
        return allowSerial && v > 20_000 && v < 80_000 ? excelSerialToIso(v) : null;
    }
    const s = String(v ?? '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    m = s.match(/\/Date\((-?\d+)/);
    if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/.test(s) || /^\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{2,4}/.test(s)) {
        const t = Date.parse(s);
        if (!isNaN(t)) return new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    }
    return null;
}

function canon(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(Number(v.toFixed(6)));
    const s = String(v).trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(Number(s).toFixed(6)));
    if (/^(true|false)$/i.test(s)) return s.toLowerCase();
    return s;
}

/**
 * Comparable form of a cell: a date as yyyy-mm-dd, a yes/no flag as Y/N, otherwise the
 * trimmed, upper-cased value. `allowSerial` reads plain numbers as Excel date serials
 * (the export's CSV dates can be parsed that way).
 */
function normKey(v: unknown, allowSerial: boolean): string {
    const d = asDate(v, allowSerial);
    if (d) return `D:${d}`;
    const s = canon(v).toUpperCase();
    if (s === 'YES' || s === 'Y' || s === 'TRUE') return 'Y';
    if (s === 'NO' || s === 'N' || s === 'FALSE') return 'N';
    return s;
}

/** True when an export cell and an API cell hold the same value. */
function sameValue(exportVal: unknown, apiVal: unknown): boolean {
    const b = normKey(apiVal, false);
    return normKey(exportVal, false) === b || normKey(exportVal, true) === b;
}

function sameMultiset(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort(), sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
}

function show(v: unknown): string {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s === '' ? '(blank)' : s.length > 60 ? s.slice(0, 57) + '...' : s;
}

// ---------- mapping sources ----------

/** Reads the PO Items grid's column headers (col-id + text), scrolling sideways so hidden columns render. */
async function readGridHeaders(app: AppCreator): Promise<{ colId: string; text: string }[]> {
    return app.Page.evaluate(async () => {
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const root = Array.from(document.querySelectorAll('[id^="VobItemDetail"] .ag-root-wrapper')).find(isVisible)
            || Array.from(document.querySelectorAll('.ag-root-wrapper')).find(isVisible);
        if (!root) return [];
        const found = new Map<string, string>();
        const collect = () => root.querySelectorAll('div.ag-header-cell').forEach(cell => {
            const colId = cell.getAttribute('col-id') || cell.getAttribute('colid') || '';
            const text = cell.querySelector('.ag-header-cell-text')?.textContent?.trim() || cell.textContent?.trim() || '';
            if (colId && text && !found.has(colId)) found.set(colId, text);
        });
        const scroller = (root.querySelector('.ag-body-horizontal-scroll-viewport') || root.querySelector('.ag-center-cols-viewport')) as HTMLElement | null;
        collect();
        if (scroller) {
            const start = scroller.scrollLeft;
            const step = Math.max(200, scroller.clientWidth - 50);
            for (let x = 0; x <= scroller.scrollWidth; x += step) {
                scroller.scrollLeft = x;
                scroller.dispatchEvent(new Event('scroll'));
                await new Promise(r => setTimeout(r, 300));
                collect();
            }
            scroller.scrollLeft = start;
            scroller.dispatchEvent(new Event('scroll'));
        }
        return Array.from(found.entries()).map(([colId, text]) => ({ colId, text }));
    }).catch(() => []);
}

const FIELD_KEYS = ['field', 'Field', 'FieldName', 'fieldName', 'DataField', 'dataField', 'ColumnName', 'columnName', 'colId', 'ColId', 'Name', 'name'];
const HEADER_KEYS = ['headerName', 'HeaderName', 'HeaderText', 'headerText', 'Caption', 'caption', 'DisplayName', 'displayName', 'Label', 'label', 'Title', 'title'];

/**
 * Finds column definitions (field + header) anywhere in the page layout config.
 * Columns found under something mentioning "VobItemDetail" are preferred.
 */
export function extractConfigColumns(config: any): { field: string; header: string; inItemGrid: boolean }[] {
    const out: { field: string; header: string; inItemGrid: boolean }[] = [];
    const seen = new Set<any>();
    const walk = (node: any, inItemGrid: boolean, depth: number) => {
        if (depth > 40 || node === null || node === undefined) return;
        if (typeof node === 'string') {
            const t = node.trim();
            if ((t.startsWith('{') || t.startsWith('[')) && t.length < 2_000_000) {
                try { walk(JSON.parse(t), inItemGrid || /VobItemDetail/i.test(t.slice(0, 2000)), depth + 1); } catch { /* not JSON */ }
            }
            return;
        }
        if (typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
            node.forEach(n => walk(n, inItemGrid, depth + 1));
            return;
        }
        const mentionsItemGrid = inItemGrid || Object.values(node).some(v => typeof v === 'string' && /VobItemDetail/i.test(v));
        const fieldKey = FIELD_KEYS.find(k => typeof node[k] === 'string' && node[k]);
        const headerKey = HEADER_KEYS.find(k => typeof node[k] === 'string' && node[k]);
        if (fieldKey && headerKey && fieldKey.toLowerCase() !== headerKey.toLowerCase()) {
            // Config headers can hold line breaks such as "Booked<br> Units".
            const header = String(node[headerKey]).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
            out.push({ field: node[fieldKey], header, inItemGrid: mentionsItemGrid });
        }
        Object.values(node).forEach(v => walk(v, mentionsItemGrid, depth + 1));
    };
    walk(config, false, 0);
    return out;
}

// ---------- comparison ----------

function findApiKey(apiKeys: string[], name: string | undefined): string | undefined {
    if (!name) return undefined;
    return apiKeys.find(k => k === name) || apiKeys.find(k => k.toLowerCase() === name.toLowerCase());
}

/** API fields whose values match the export column on every row of this booking (order-independent). */
function fieldsMatchingByValues(exportRows: any[], apiRows: any[], header: string, apiKeys: string[]): string[] {
    if (exportRows.length !== apiRows.length) return [];
    if (exportRows.every(r => canon(r[header]) === '')) return [];
    const exportPlain = exportRows.map(r => normKey(r[header], false));
    const exportSerial = exportRows.map(r => normKey(r[header], true));
    return apiKeys.filter(key => {
        const apiVals = apiRows.map(r => normKey(r[key], false));
        return sameMultiset(exportPlain, apiVals) || sameMultiset(exportSerial, apiVals);
    });
}

/** Share (0-1) of export values that also appear in the API field, order-independent. */
function valueOverlap(exportRows: any[], apiRows: any[], header: string, key: string): number {
    const counts = new Map<string, number>();
    apiRows.forEach(r => { const k = normKey(r[key], false); counts.set(k, (counts.get(k) || 0) + 1); });
    let hits = 0;
    for (const r of exportRows) {
        const k = [normKey(r[header], false), normKey(r[header], true)].find(x => (counts.get(x) || 0) > 0);
        if (k !== undefined) { hits++; counts.set(k, counts.get(k)! - 1); }
    }
    return exportRows.length ? hits / exportRows.length : 0;
}

export function compareBooking(
    exportRows: any[],
    apiRows: any[],
    gridHeaders: { colId: string; text: string }[],
    configColumns: { field: string; header: string; inItemGrid: boolean }[]
): Pick<BookingComparison, 'columns' | 'unusedApiFields' | 'rowAlignment'> {
    const exportColumns = Object.keys(exportRows[0] || {});
    const apiKeys = Array.from(new Set(apiRows.flatMap(r => Object.keys(r || {}))));

    // 1. Map each export column to an API field.
    const mapping = new Map<string, { field: string; by: MappedBy }>();
    const used = new Set<string>();
    const configSorted = [...configColumns].sort((a, b) => Number(b.inItemGrid) - Number(a.inItemGrid));
    for (const header of exportColumns) {
        const byGrid = findApiKey(apiKeys, gridHeaders.find(h => h.text === header)?.colId);
        const byConfig = configSorted
            .filter(c => c.header === header)
            .map(c => findApiKey(apiKeys, c.field))
            .find(Boolean);
        const byValues = fieldsMatchingByValues(exportRows, apiRows, header, apiKeys).filter(k => !used.has(k));
        const choice: { field: string; by: MappedBy } | undefined =
            byGrid ? { field: byGrid, by: 'grid-header' } :
            byConfig ? { field: byConfig, by: 'page-config' } :
            byValues.length === 1 ? { field: byValues[0], by: 'values' } :
            undefined;
        if (choice) {
            mapping.set(header, choice);
            used.add(choice.field);
        }
    }

    // 1b. Still unmapped: take the unused field holding most of the values (>= 50%), so a
    // column that only differs on some rows is reported as "values differ", not "no field".
    for (const header of exportColumns) {
        if (mapping.has(header) || exportRows.every(r => canon(r[header]) === '')) continue;
        const scored = apiKeys
            .filter(k => !used.has(k))
            .map(k => ({ k, score: valueOverlap(exportRows, apiRows, header, k) }))
            .filter(x => x.score >= 0.5)
            .sort((a, b) => b.score - a.score);
        if (scored.length > 0 && (scored.length === 1 || scored[0].score > scored[1].score)) {
            mapping.set(header, { field: scored[0].k, by: 'values-partial' });
            used.add(scored[0].k);
        }
    }

    // 2. Pair export rows with API rows: by key columns when unique, else by position.
    let pairs: [any, any][] = [];
    let rowAlignment = 'by position';
    const keyHeaders = KEY_COLUMNS.filter(h => mapping.has(h));
    if (keyHeaders.length > 0) {
        const keyOf = (row: any, side: 'export' | 'api') =>
            keyHeaders.map(h => canon(side === 'export' ? row[h] : row[mapping.get(h)!.field]).toUpperCase()).join('|');
        const apiByKey = new Map<string, any[]>();
        apiRows.forEach(r => {
            const k = keyOf(r, 'api');
            apiByKey.set(k, [...(apiByKey.get(k) || []), r]);
        });
        const exportKeys = exportRows.map(r => keyOf(r, 'export'));
        const unique = new Set(exportKeys).size === exportKeys.length && Array.from(apiByKey.values()).every(v => v.length === 1);
        if (unique && exportKeys.every(k => apiByKey.has(k))) {
            pairs = exportRows.map((r, i) => [r, apiByKey.get(exportKeys[i])![0]]);
            rowAlignment = `by ${keyHeaders.join(' + ')}`;
        }
    }
    if (pairs.length === 0) {
        const n = Math.min(exportRows.length, apiRows.length);
        for (let i = 0; i < n; i++) pairs.push([exportRows[i], apiRows[i]]);
    }

    // 3. Compare every cell.
    const columns: ColumnResult[] = exportColumns.map(header => {
        const m = mapping.get(header);
        if (!m) {
            const allBlank = exportRows.every(r => canon(r[header]) === '');
            return {
                exportColumn: header,
                status: 'no-field',
                cellsCompared: 0,
                cellsDifferent: 0,
                example: allBlank ? 'export column is blank for this booking' : `export e.g. ${show(exportRows.find(r => canon(r[header]) !== '')?.[header])}`,
            };
        }
        let different = 0;
        let example: string | undefined;
        let anyValue = false;
        for (const [er, ar] of pairs) {
            if (canon(er[header]) !== '' || canon(ar[m.field]) !== '') anyValue = true;
            if (!sameValue(er[header], ar[m.field])) {
                different++;
                if (!example) example = `export ${show(er[header])} vs API ${show(ar[m.field])}`;
            }
        }
        return {
            exportColumn: header,
            apiField: m.field,
            mappedBy: m.by,
            status: different > 0 ? 'mismatch' : anyValue ? 'match' : 'match-blank',
            cellsCompared: pairs.length,
            cellsDifferent: different,
            example,
        };
    });

    const unusedApiFields = apiKeys
        .filter(k => !used.has(k))
        .map(k => ({ field: k, sample: show(apiRows.find(r => canon(r[k]) !== '')?.[k]) }));

    return { columns, unusedApiFields, rowAlignment };
}

// ---------- main ----------

function timestamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const secondsSince = (t: number) => Math.round((Date.now() - t) / 100) / 10;

/** Rows array from a Century API response (plain array or WebApiResult wrapper). */
function rowsFromResponse(json: any): any[] | null {
    if (Array.isArray(json)) return json;
    for (const k of ['GridDataTable', 'ResultData', 'data']) {
        if (Array.isArray(json?.[k])) return json[k];
    }
    if (json?.GridDataSet && typeof json.GridDataSet === 'object') {
        const first = Object.values(json.GridDataSet).find(Array.isArray);
        if (first) return first as any[];
    }
    return null;
}

/** Screenshot plus the tabs/buttons on screen, to see why the PO Items tab or its button was not found. */
async function saveDiagnostics(app: AppCreator, dir: string, bookingKey: string) {
    const base = path.join(dir, sanitize(bookingKey));
    try { await app.Page.screenshot({ path: `${base}_page.png` as `${string}.png`, fullPage: true }); } catch { /* ignore */ }
    const info = await app.Page.evaluate(() => {
        const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const brief = (e: Element) => ({
            tag: e.tagName.toLowerCase(),
            id: e.id,
            class: (e.getAttribute('class') || '').slice(0, 120),
            href: e.getAttribute('href') || undefined,
            role: e.getAttribute('role') || undefined,
            title: e.getAttribute('title') || undefined,
            text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
            visible: isVisible(e),
        });
        return {
            url: location.href,
            tabs: Array.from(document.querySelectorAll('li, [role="tab"], a[href^="#"]'))
                .filter(e => (e.textContent || '').trim().length > 0 && (e.textContent || '').trim().length < 40)
                .slice(0, 80).map(brief),
            vobIds: Array.from(document.querySelectorAll('[id*="Vob"], [id*="vob"]')).slice(0, 150).map(brief),
            buttons: Array.from(document.querySelectorAll('button, a.btn, [role="button"]')).filter(isVisible).slice(0, 150).map(brief),
        };
    }).catch(err => ({ error: String(err) }));
    fs.writeFileSync(`${base}_page_info.json`, JSON.stringify(info, null, 2));
    console.log(`[compare] Saved page screenshot and tab/button list: ${base}_page.png / _page_info.json`);
}

export default async function comparePoItemsApi(app: AppCreator, bookingKeys: string[]) {
    const baseDir = app.initData.settings?.downloadDir || app.initData.downloadDir || path.join(os.homedir(), 'Downloads');
    const outDir = path.join(baseDir, `PO_Items_API_Comparison_${timestamp(new Date())}`);
    const rawDir = path.join(outDir, 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'centuryvms-po-compare-'));
    console.log(`[compare] Output folder: ${outDir}`);

    await app.openPortalPage("https://www.centuryvms.com/#/pagelayout?moduleCd=Vob&configName=VobMain");
    const api = new CenturyAPIProvider(await app.createSession());

    // Page layout config: one source of export header -> API field. If the direct call fails,
    // the copy the browser loads with each booking is used instead.
    let configColumns: { field: string; header: string; inItemGrid: boolean }[] = [];
    const useConfig = (data: any, from: string) => {
        configColumns = extractConfigColumns(data);
        console.log(`[compare] Page layout config (${from}): ${configColumns.length} column definition(s), ${configColumns.filter(c => c.inItemGrid).length} under VobItemDetail.`);
    };
    const cfg = await api.getPageLayoutConfig('Vob', 'VobWorkspace');
    if (cfg.success) {
        fs.writeFileSync(path.join(rawDir, 'PageLayout_VobWorkspace.json'), JSON.stringify(cfg.data, null, 2));
        useConfig(cfg.data, 'API');
    } else {
        console.warn(`[compare] Page layout config call failed (${cfg.message}); will use the browser's copy.`);
    }

    const results: BookingComparison[] = [];
    const network: { booking: string; method: string; status: number; url: string; postData: string; savedAs: string }[] = [];

    for (const bookingKey of bookingKeys) {
        console.log(`\n[compare] ===== ${bookingKey} =====`);
        const blank = (apiName: string): BookingComparison => ({
            bookingKey, api: apiName, exportRows: 0, apiRows: 0, pageOpenSec: 0, exportSec: 0, apiSec: 0,
            rowAlignment: '', columns: [], unusedApiFields: [],
        });

        // Record what the page itself calls while the booking and its PO Items tab load.
        let netCount = 0;
        let gridApiRows: any[] | null = null;
        let gridApiCall = '';
        const onResponse = async (res: HTTPResponse) => {
            const url = res.url();
            if (!NETWORK_URL_PATTERN.test(url)) return;
            const req = res.request();
            const entry = { booking: bookingKey, method: req.method(), status: res.status(), url, postData: (req.postData() || '').slice(0, 2000), savedAs: '' };
            network.push(entry);
            if (req.method() === 'OPTIONS') return;
            try {
                if ((res.headers()['content-type'] || '').includes('json')) {
                    const body = await res.text();
                    if (body.length < 5_000_000) {
                        entry.savedAs = `${sanitize(bookingKey)}_net_${++netCount}.json`;
                        fs.writeFileSync(path.join(rawDir, entry.savedAs), body);
                    }
                    if (/GetItemDetail/i.test(url)) {
                        gridApiRows = rowsFromResponse(JSON.parse(body));
                        gridApiCall = `${req.method()} ${url}${entry.postData ? ` body=${entry.postData}` : ''}`;
                    } else if (configColumns.length === 0 && /GetByConfigName/i.test(url) && /VobWorkspace/i.test(url)) {
                        useConfig(JSON.parse(body), 'browser');
                    }
                }
            } catch { /* body not available (redirect/preflight) */ }
        };
        app.Page.on('response', onResponse);

        try {
            let t = Date.now();
            const opened = await openAndVerifyExistingBooking(app, bookingKey);
            const pageOpenSec = secondsSince(t);
            if (!opened.success) throw new Error(opened.message);

            t = Date.now();
            // Always the real grid export here: it is what the API is compared against.
            const exp = await downloadPoItemFile(app, bookingKey, outDir, exportDir, false, { useApi: false });
            const exportSec = secondsSince(t);
            if (!exp.success || !exp.rows) {
                await saveDiagnostics(app, rawDir, bookingKey);
                throw new Error(`Download failed: ${exp.message}`);
            }
            fs.writeFileSync(path.join(rawDir, `${sanitize(bookingKey)}_export_rows.json`), JSON.stringify(exp.rows, null, 2));

            const gridHeaders = await readGridHeaders(app);
            fs.writeFileSync(path.join(rawDir, `${sanitize(bookingKey)}_grid_headers.json`), JSON.stringify(gridHeaders, null, 2));

            // API 1: SearchBookingItem, called directly.
            t = Date.now();
            const apiRes = await api.getAllBookingItems(bookingKey);
            const searchSec = secondsSince(t);
            const searchRows = apiRes.found && Array.isArray(apiRes.data) ? apiRes.data : null;
            if (searchRows) fs.writeFileSync(path.join(rawDir, `${sanitize(bookingKey)}_api_SearchBookingItem.json`), JSON.stringify(searchRows, null, 2));

            const sources: { name: string; rows: any[] | null; sec: number; note: string }[] = [
                { name: 'SearchBookingItem', rows: searchRows, sec: searchSec, note: searchRows ? '' : `no rows: ${apiRes.message || ''}` },
                { name: 'GetItemDetail (grid)', rows: gridApiRows, sec: 0, note: gridApiRows ? gridApiCall : 'grid call not seen' },
            ];
            for (const src of sources) {
                const result = blank(src.name);
                results.push(result);
                result.pageOpenSec = pageOpenSec;
                result.exportSec = exportSec;
                result.exportRows = exp.rows.length;
                result.apiSec = src.sec;
                result.apiNote = src.note;
                if (!src.rows || src.rows.length === 0) {
                    result.error = `${src.name}: ${src.note}`;
                    console.warn(`[compare] ${src.name}: ${src.note}`);
                    continue;
                }
                result.apiRows = src.rows.length;
                Object.assign(result, compareBooking(exp.rows, src.rows, gridHeaders, configColumns));
                const bad = result.columns.filter(c => c.status === 'mismatch' || c.status === 'no-field');
                console.log(`[compare] ${src.name}: rows export=${result.exportRows} api=${result.apiRows} | open ${pageOpenSec}s, download ${exportSec}s, api ${src.sec}s | ` +
                    `${result.columns.length - bad.length}/${result.columns.length} columns OK`);
                bad.forEach(c => console.log(`[compare]   ${c.status.toUpperCase()}: "${c.exportColumn}"${c.apiField ? ` <- ${c.apiField}` : ''} ${c.example || ''}`));
            }
        } catch (err: any) {
            const result = blank('-');
            result.error = err?.message || String(err);
            results.push(result);
            console.warn(`[compare] ${bookingKey} skipped: ${result.error}`);
        } finally {
            app.Page.off('response', onResponse);
        }
    }

    try { fs.rmSync(exportDir, { recursive: true, force: true }); } catch { /* temp */ }

    // ---------- report ----------
    const compared = results.filter(r => !r.error);
    type Agg = { api: string; col: string; fields: Set<string>; by: Set<string>; match: number; blank: number; mismatch: number; noField: number; cells: number; examples: string[] };
    const byColumn = new Map<string, Agg>();
    for (const r of compared) {
        for (const c of r.columns) {
            const key = `${r.api}||${c.exportColumn}`;
            const agg = byColumn.get(key) || { api: r.api, col: c.exportColumn, fields: new Set<string>(), by: new Set<string>(), match: 0, blank: 0, mismatch: 0, noField: 0, cells: 0, examples: [] };
            if (c.apiField) agg.fields.add(c.apiField);
            if (c.mappedBy) agg.by.add(c.mappedBy);
            if (c.status === 'match') agg.match++;
            if (c.status === 'match-blank') agg.blank++;
            if (c.status === 'mismatch') agg.mismatch++;
            if (c.status === 'no-field') agg.noField++;
            agg.cells += c.cellsDifferent;
            if (c.example && agg.examples.length < 2 && c.status !== 'match') agg.examples.push(`${r.bookingKey}: ${c.example}`);
            byColumn.set(key, agg);
        }
    }

    const verdictOf = (a: Agg) =>
        a.fields.size > 1 ? 'DIFFERENT FIELDS PER BOOKING' :
        a.mismatch > 0 ? 'VALUES DIFFER' :
        a.noField > 0 && a.match === 0 && a.blank === 0 ? 'NO API FIELD' :
        a.noField > 0 ? 'PARTLY MAPPED' :
        a.match === 0 ? 'OK (always blank, unverified)' : 'OK';

    const columnRows = Array.from(byColumn.values()).map(a => ({
        'API': a.api,
        'Export Column': a.col,
        'API Field': Array.from(a.fields).join(', '),
        'Mapped By': Array.from(a.by).join(', '),
        'Verdict': verdictOf(a),
        'Bookings Matched': a.match,
        'Bookings Both Blank': a.blank,
        'Bookings Different': a.mismatch,
        'Bookings No Field': a.noField,
        'Cells Different': a.cells,
        'Examples': a.examples.join(' | '),
    }));

    const summaryRows = results.map(r => ({
        'Booking': r.bookingKey,
        'API': r.api,
        'Result': r.error ? `Skipped: ${r.error}` : r.columns.every(c => c.status === 'match' || c.status === 'match-blank') && r.exportRows === r.apiRows ? 'API matches download' : 'Differences',
        'Download Rows': r.exportRows,
        'API Rows': r.apiRows,
        'Rows Paired': r.rowAlignment,
        'Open Booking (s)': r.pageOpenSec,
        'PO Items Download (s)': r.exportSec,
        'API Call (s)': r.apiSec,
        'Columns OK': r.columns.filter(c => c.status === 'match' || c.status === 'match-blank').length,
        'Columns Different': r.columns.filter(c => c.status === 'mismatch').length,
        'Columns No Field': r.columns.filter(c => c.status === 'no-field').length,
        'API Call': r.apiNote || '',
    }));

    const unused = new Map<string, { api: string; field: string; sample: string }>();
    compared.forEach(r => r.unusedApiFields.forEach(u => {
        const key = `${r.api}||${u.field}`;
        if (!unused.has(key) || unused.get(key)!.sample === '(blank)') unused.set(key, { api: r.api, field: u.field, sample: u.sample });
    }));
    const unusedRows = Array.from(unused.values()).map(u => ({ 'API': u.api, 'API Field': u.field, 'Sample Value': u.sample }));

    const configRows = configColumns.filter(c => c.inItemGrid).map(c => ({ 'Header (config)': c.header, 'Field': c.field }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(columnRows), 'Columns');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Bookings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unusedRows), 'API Fields Not In Download');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configRows), 'Grid Config Columns');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(network), 'Network Calls');
    const reportPath = path.join(outDir, 'report.xlsx');
    fs.writeFileSync(reportPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    // ---------- console verdict ----------
    console.log('\n==================== PO ITEMS: API vs DOWNLOAD ====================');
    const skipped = results.filter(r => r.api === '-');
    if (skipped.length) console.log(`Bookings skipped: ${skipped.length}/${bookingKeys.length} (see Bookings sheet)`);
    for (const apiName of Array.from(new Set(compared.map(r => r.api)))) {
        const rs = compared.filter(r => r.api === apiName);
        const avg = (f: (r: BookingComparison) => number) => (rs.reduce((s, r) => s + f(r), 0) / rs.length).toFixed(1);
        console.log(`\n--- ${apiName}: ${rs.length} booking(s) compared`);
        console.log(`Average per booking: open page ${avg(r => r.pageOpenSec)}s, download ${avg(r => r.exportSec)}s, API ${avg(r => r.apiSec)}s`);
        const rowMismatch = rs.filter(r => r.exportRows !== r.apiRows);
        if (rowMismatch.length) console.log(`Row counts differ: ${rowMismatch.map(r => `${r.bookingKey} (${r.exportRows} vs ${r.apiRows})`).join(', ')}`);
        const cols = columnRows.filter(c => c.API === apiName);
        const problems = cols.filter(c => !String(c.Verdict).startsWith('OK'));
        const unverified = cols.filter(c => c.Verdict === 'OK (always blank, unverified)');
        if (problems.length === 0 && rowMismatch.length === 0) {
            console.log(`✅ All ${cols.length} download columns matched on every compared booking.`);
        } else {
            console.log(`❌ ${problems.length} of ${cols.length} download columns do not match:`);
            problems.forEach(p => console.log(`   - ${p['Export Column']}: ${p.Verdict}${p['API Field'] ? ` (${p['API Field']})` : ''}${p.Examples ? ` e.g. ${p.Examples}` : ''}`));
        }
        if (unverified.length) console.log(`ℹ️ Always blank in these bookings, so not verified: ${unverified.map(u => u['Export Column']).join(', ')}`);
    }
    console.log(`\nReport: ${reportPath}`);
    console.log(`Raw data: ${rawDir}`);
}
