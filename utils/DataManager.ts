import {Workbook, Worksheet} from "exceljs";
import * as Path from 'path';
import { isEmpty } from "./common";
import { IDataFormExcel } from "./types";

/** Error with a message that is safe to show to the user as-is. */
export class DataManagerError extends Error {}

/** Columns whose bare numbers may be Excel date serials. */
const DATE_COLUMNS = new Set(['working_date', 'window_end', 'ecdd']);

/** Header row is scanned only in the first N rows of a sheet. */
const MAX_HEADER_SCAN_ROWS = 30;

function excelSerialToIso(v: number): string | null {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + v * 86400000);
    if (!isNaN(date.getTime()) && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100) {
        return date.toISOString();
    }
    return null;
}

function getCellValueFromCell(cell: any, isDateColumn: boolean = false): string {
    if (!cell) return '';

    const v = cell.value;
    if (v === null || v === undefined) {
        return String(cell.text ?? '').trim();
    }

    if (v instanceof Date) {
        return isNaN(v.getTime()) ? '' : v.toISOString();
    }

    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) {
            return v.richText.map((t: any) => t.text || '').join('').trim();
        }
        // Formula cells (incl. shared formulas that carry no cached result of their own)
        if ('formula' in v || 'sharedFormula' in v || 'result' in v) {
            const res = 'result' in v ? v.result : cell.result;
            if (res instanceof Date) return isNaN(res.getTime()) ? '' : res.toISOString();
            if (res === null || res === undefined || typeof res === 'object') return '';
            if (typeof res === 'number' && isDateColumn) return excelSerialToIso(res) ?? String(res);
            return String(res).trim();
        }
        if ('text' in v) {
            return String(v.text ?? '').trim();
        }
        if ('error' in v) {
            return '';
        }
        const text = String(cell.text ?? '').trim();
        return text === '[object Object]' ? '' : text;
    }

    if (typeof v === 'number') {
        // Only treat a number as a date when Excel says so (date format) or the column is a date column.
        const hasDateFormat = typeof cell.numFmt === 'string' && /(yy|dd|mmm)/i.test(cell.numFmt);
        if (hasDateFormat || isDateColumn) {
            const iso = excelSerialToIso(v);
            if (iso) return iso;
        }
        return String(v).trim();
    }

    const str = String(v).trim();
    if (str) return str;
    return String(cell.text ?? '').trim();
}

const BOOKING_EXACT = new Set([
    'booking', 'bookings', 'booking number', 'booking no', 'booking no.', 'booking #', 'booking key', 'booking id',
    'draft booking no', 'draft booking no.', 'draft booking number', 'vob', 'vob no', 'vob no.', 'vob number',
    'bk', 'bk no', 'bk no.', 'bk #',
]);

type AliasMatch = { alias: string; exact: boolean };

function normalizeHeader(rawHeader: string): string {
    return rawHeader.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchColumnAlias(rawHeader: string): AliasMatch | null {
    const norm = normalizeHeader(rawHeader);
    if (!norm) return null;

    const exact = (alias: string): AliasMatch => ({ alias, exact: true });
    const fuzzy = (alias: string): AliasMatch => ({ alias, exact: false });

    if (norm === 'sl no' || norm === 'sl' || norm === 'serial number' || norm === 'sl. no' || norm === 'sl_no') return exact('sl');
    if (BOOKING_EXACT.has(norm)) return exact('booking_number');
    if (
        (norm.includes('booking') || norm.includes('vob')) &&
        (/\b(number|no|key|id)\b/.test(norm) || norm.includes('#')) &&
        !/(date|status|created|unit|qty|quantity|other)/.test(norm)
    ) return fuzzy('booking_number');
    if (norm === 'working date') return exact('working_date');
    if (norm.includes('working date')) return fuzzy('working_date');
    if (norm === 'ship mode') return exact('ship_mode');
    if (norm.includes('ship mode')) return fuzzy('ship_mode');
    if (norm === 'freight type') return exact('freight_type');
    if (norm.includes('freight type')) return fuzzy('freight_type');
    if (norm === 'incoterms' || norm === 'incoterm') return exact('incoterms');
    if (norm.includes('incoterm')) return fuzzy('incoterms');
    if (norm === 'fob port' || norm === 'fob') return exact('fob_port');
    if (norm.includes('fob port')) return fuzzy('fob_port');
    if (norm === 'order type') return exact('order_type');
    if (norm.includes('order type')) return fuzzy('order_type');
    if (norm === 'po' || norm === 'po #' || norm === 'po no' || norm === 'po number') return exact('po');
    if (norm === 'asin' || norm === 'asin #') return exact('asin');
    if (norm.includes('asin') && !norm.includes('asin fc')) return fuzzy('asin');
    if (norm === 'model' || norm === 'model #') return exact('model');
    if (norm.includes('model')) return fuzzy('model');
    if (norm === 'po qty' || norm === 'po quantity' || norm === 'booked units') return exact('po_quantity');
    if (norm.includes('po qty') || norm.includes('po quantity') || norm.includes('booked units')) return fuzzy('po_quantity');
    if (norm === 'case pack') return exact('case_pack');
    if (norm.includes('case pack')) return fuzzy('case_pack');
    if (norm === 'carton qty' || norm === 'booked cartons') return exact('carton_qty');
    if (norm.includes('carton qty') || norm.includes('carton') || norm.includes('booked cartons')) return fuzzy('carton_qty');
    if (norm === 'gross weight') return exact('gross_weight');
    if (norm.includes('gross weight') || norm.includes('gross wt')) return fuzzy('gross_weight');
    if (norm === 'net weight') return exact('net_weight');
    if (norm.includes('net weight') || norm.includes('net wt')) return fuzzy('net_weight');
    if (norm === 'cbm') return exact('cbm');
    if (norm.includes('cbm') || norm.includes('volume')) return fuzzy('cbm');
    if (norm === 'window end') return exact('window_end');
    if (norm.includes('window end')) return fuzzy('window_end');
    if (norm === 'ecdd') return exact('ecdd');
    if (norm.includes('ecdd') || norm.includes('estimated cargo delivery') || norm.includes('cargo delivery date')) return fuzzy('ecdd');
    if (norm === 'file') return exact('file');
    if (norm === 'po status') return exact('po_status');
    if (norm.includes('po status')) return fuzzy('po_status');
    if (norm === 'ship/vendor code') return exact('ship_code');
    if (norm.includes('ship/vendor') || norm.includes('vendor code') || norm.includes('ship code')) return fuzzy('ship_code');
    if (norm === 'factory') return exact('factory');
    if (norm.includes('factory')) return fuzzy('factory');
    if (norm === 'ship') return exact('ship');

    return null;
}

type HeaderScan = { rowNumber: number; headers: { [alias: string]: number } };

/**
 * Finds the header row of a sheet. A row qualifies when it has a booking-number
 * column, or at least two recognised columns. Exact header names win over fuzzy
 * ones; among equals the left-most column wins.
 */
function scanHeaders(sheet: Worksheet): HeaderScan | null {
    const maxScanRows = Math.min(sheet.actualRowCount, MAX_HEADER_SCAN_ROWS);
    for (let i = 1; i <= maxScanRows; i++) {
        const matches: { [alias: string]: { col: number; exact: boolean } } = {};
        sheet.getRow(i).eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const m = matchColumnAlias(getCellValueFromCell(cell));
            if (!m) return;
            const prev = matches[m.alias];
            if (!prev || (m.exact && !prev.exact)) {
                matches[m.alias] = { col: colNumber, exact: m.exact };
            }
        });
        const aliases = Object.keys(matches);
        if (matches['booking_number'] || aliases.length >= 2) {
            const headers: { [alias: string]: number } = {};
            for (const a of aliases) headers[a] = matches[a].col;
            return { rowNumber: i, headers };
        }
    }
    return null;
}

export class DataManager {
    public readonly headers: { [alias: string]: number } = {};
    /** Data rows that were skipped because they had no booking number. */
    public skippedRows = 0;
    private readonly validRows:number[][]=[]
    private readonly workBook:Workbook
    private readonly src:Path.ParsedPath
    private worksheet: Worksheet= undefined as unknown as Worksheet
    private tableDataStartsAt=0
    private currentIndex=0
    constructor(src:string){
        this.workBook=new Workbook()
        this.src=Path.parse(src)
    }
    async init(){
        await this.workBook.xlsx.readFile(Path.format(this.src))

        // Prefer sheets whose name looks like an upload/booking format, then all others.
        const preferred: Worksheet[] = [];
        const others: Worksheet[] = [];
        this.workBook.eachSheet((sheet) => {
            const name = sheet.name.trim().toLowerCase();
            if (name === 'format' || name.includes('format') || name.includes('booking') || name.includes('upload')) {
                preferred.push(sheet);
            } else {
                others.push(sheet);
            }
        });

        // Use the first sheet that has a booking-number column.
        for (const sheet of [...preferred, ...others]) {
            const scan = scanHeaders(sheet);
            if (scan && scan.headers['booking_number']) {
                this.worksheet = sheet;
                this.tableDataStartsAt = scan.rowNumber + 1;
                Object.assign(this.headers, scan.headers);
                break;
            }
        }

        if (!this.worksheet) {
            throw new DataManagerError(
                "No 'Booking Number' column was found in the Excel file. Add a column named 'Booking Number' containing the Century VMS booking keys."
            );
        }

        console.log(`[DataManager] Selected worksheet: "${this.worksheet.name}", header row ${this.tableDataStartsAt - 1}`);
        console.log("[DataManager] Detected Headers:", this.headers);

        this.listValidRows();
    }

    /**
     * Groups data rows by booking number across the whole sheet (first-seen order),
     * so a booking that appears on non-adjacent rows is processed once.
     */
    listValidRows() {
        const bookingCol = this.headers['booking_number'];
        const groups = new Map<string, number[]>();
        let skipped = 0;

        for (let i = this.tableDataStartsAt; i <= this.worksheet.actualRowCount; i++) {
            const bookingNum = getCellValueFromCell(this.worksheet.getCell(i, bookingCol)).trim();
            // Formula placeholders such as "0" or "-" are not booking numbers.
            if (isEmpty(bookingNum) || /^[0\-\s.]+$/.test(bookingNum)) {
                if (this.rowHasData(i)) skipped++;
                continue;
            }
            const key = bookingNum.toUpperCase();
            const group = groups.get(key);
            if (group) group.push(i);
            else groups.set(key, [i]);
        }

        this.validRows.push(...groups.values());
        this.skippedRows = skipped;
        console.log(`[DataManager] ${this.validRows.length} booking group(s), ${skipped} row(s) without booking number skipped.`);
    }

    private rowHasData(row: number): boolean {
        for (const key in this.headers) {
            if (key === 'sl') continue;
            if (!isEmpty(getCellValueFromCell(this.worksheet.getCell(row, this.headers[key])))) return true;
        }
        return false;
    }

    private _getData(row:number):IDataFormExcel{
        const rowObj: any={}
        for (const key in this.headers){
            const colIndex = this.headers[key];
            if (!colIndex) continue;
            const cell = this.worksheet.getCell(row, colIndex);
            rowObj[key] = getCellValueFromCell(cell, DATE_COLUMNS.has(key));
        }
        return rowObj as IDataFormExcel;
    }

    getData(): IDataFormExcel[] | undefined {
        if(this.haveNext()){
            const groupIndex=this.validRows[this.currentIndex];
            const groupData:IDataFormExcel[]=[]
            for(const grIndex of groupIndex){
                const d=this._getData(grIndex)
                if(d){
                    groupData.push(d)
                }
            }

            // Propagate common header fields if missing in some rows of the group
            const headerFields = ['booking_number', 'ship_mode', 'incoterms', 'fob_port', 'ecdd', 'working_date', 'freight_type'];
            for (const field of headerFields) {
                const foundVal = groupData.find(item => !isEmpty((item as any)[field])) as any;
                if (foundVal && foundVal[field]) {
                    for (const item of groupData) {
                        if (isEmpty((item as any)[field])) {
                            (item as any)[field] = foundVal[field];
                        }
                    }
                }
            }

            return groupData;
        }
        return undefined;
    }
    haveNext(): boolean {
        return this.currentIndex<this.validRows.length
    }
    next(): boolean {
        this.currentIndex++;
        return this.currentIndex<this.validRows.length
    }
    get length(): number {
        return this.validRows.length
    }

    get missingRequiredHeaders(): string[] {
        const required = ['booking_number'];
        return required.filter(col => !this.headers[col]);
    }
}

export class MemoryDataManager {
    public readonly headers: { [alias: string]: number } = { booking_number: 1 };
    public skippedRows = 0;
    private readonly groups: IDataFormExcel[][] = [];
    private currentIndex = 0;

    constructor(
        bookings: Array<{ booking_number: string; comp_cd?: string; vendor_cd?: string; po?: string; status?: string } | string>,
        defaultCompanyCode?: string
    ) {
        bookings.forEach((item, index) => {
            const bookingNumber = typeof item === 'string' ? item.trim() : (item.booking_number || '').trim();
            if (!bookingNumber) return;

            const compCd = typeof item === 'object' ? (item.comp_cd || defaultCompanyCode || '') : (defaultCompanyCode || '');
            const vendorCd = typeof item === 'object' ? (item.vendor_cd || '') : '';
            // PO is unknown for selected bookings unless explicitly given; it is detected from the PO items later.
            const po = typeof item === 'object' ? (item.po || '').trim() : '';
            const status = typeof item === 'object' ? (item.status || '') : '';

            const rowObj: any = {
                sl: String(index + 1),
                booking_number: bookingNumber,
                po: po,
                comp_cd: compCd,
                ship_code: vendorCd,
                po_status: status,
                working_date: '',
                ship_mode: '',
                freight_type: '',
                incoterms: '',
                fob_port: '',
                order_type: '',
                asin: '',
                model: '',
                po_quantity: '',
                case_pack: '',
                carton_qty: '',
                gross_weight: '',
                net_weight: '',
                cbm: '',
                window_end: '',
                ecdd: '',
                file: '',
                factory: '',
                ship: ''
            };
            this.groups.push([rowObj as IDataFormExcel]);
        });
        console.log(`[MemoryDataManager] Initialized with ${this.groups.length} booking(s).`);
    }

    async init(): Promise<void> {
        return Promise.resolve();
    }

    getData(): IDataFormExcel[] | undefined {
        if (this.haveNext()) {
            return this.groups[this.currentIndex];
        }
        return undefined;
    }

    haveNext(): boolean {
        return this.currentIndex < this.groups.length;
    }

    next(): boolean {
        this.currentIndex++;
        return this.currentIndex < this.groups.length;
    }

    get length(): number {
        return this.groups.length;
    }

    get missingRequiredHeaders(): string[] {
        return [];
    }
}
