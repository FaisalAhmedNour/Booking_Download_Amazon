import {Workbook, Worksheet} from "exceljs";
import * as Path from 'path';
import { isEmpty, sleep } from "./common";
import { ColumnAlias, IDataFormExcel } from "./types";

function getCellValueFromCell(cell: any): string {
    if (!cell) return '';

    const v = cell.value;
    if (v === null || v === undefined) {
        return (cell.text || '').trim();
    }

    if (v instanceof Date) {
        if (!isNaN(v.getTime())) {
            return v.toISOString();
        }
    }

    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) {
            return v.richText.map((t: any) => t.text || '').join('').trim();
        }
        if ('result' in v) {
            const res = v.result;
            if (res instanceof Date && !isNaN(res.getTime())) {
                return res.toISOString();
            }
            return String(res ?? '').trim();
        }
        if ('text' in v) {
            return String(v.text ?? '').trim();
        }
    }

    if (typeof v === 'number') {
        // Check if number is an Excel date serial (typically between 30000 and 60000)
        if (cell.type === 4 /* Date */ || (cell.numFmt && /yy|mm|dd/i.test(cell.numFmt)) || (v > 30000 && v < 60000)) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const date = new Date(excelEpoch.getTime() + v * 86400000);
            if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date.toISOString();
            }
        }
        return String(v).trim();
    }

    const str = String(v).trim();
    if (str) return str;
    return (cell.text || '').trim();
}

function matchColumnAlias(rawHeader: string): string | null {
    const norm = rawHeader.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!norm) return null;

    if (norm === 'sl no' || norm === 'sl' || norm === 'serial number' || norm === 'sl. no' || norm === 'sl_no') return 'sl';
    if (
        norm === 'booking' ||
        norm === 'bookings' ||
        norm.includes('booking') ||
        norm.includes('vob')
    ) return 'booking_number';
    if (norm.includes('working date')) return 'working_date';
    if (norm.includes('ship mode')) return 'ship_mode';
    if (norm.includes('freight type')) return 'freight_type';
    if (norm.includes('incoterm')) return 'incoterms';
    if (norm.includes('fob port') || norm === 'fob') return 'fob_port';
    if (norm.includes('order type')) return 'order_type';
    if (norm === 'po' || norm === 'po #' || norm === 'po no' || norm === 'po number') return 'po';
    if (norm.includes('asin')) return 'asin';
    if (norm.includes('model')) return 'model';
    if (norm.includes('po qty') || norm.includes('po quantity') || norm.includes('booked units')) return 'po_quantity';
    if (norm.includes('case pack')) return 'case_pack';
    if (norm.includes('carton qty') || norm.includes('carton') || norm.includes('booked cartons')) return 'carton_qty';
    if (norm.includes('gross weight') || norm.includes('gross wt')) return 'gross_weight';
    if (norm.includes('net weight') || norm.includes('net wt')) return 'net_weight';
    if (norm.includes('cbm') || norm.includes('volume')) return 'cbm';
    if (norm.includes('window end')) return 'window_end';
    if (norm.includes('ecdd') || norm.includes('estimated cargo delivery') || norm.includes('cargo delivery date')) return 'ecdd';
    if (norm === 'file') return 'file';
    if (norm.includes('po status')) return 'po_status';
    if (norm.includes('ship/vendor') || norm.includes('vendor code') || norm.includes('ship code')) return 'ship_code';
    if (norm.includes('factory')) return 'factory';
    if (norm === 'ship') return 'ship';

    return null;
}

export class DataManager {
    public readonly headers: { [alias: string]: number } = {};
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
        // Find best matching worksheet (case-insensitive, trimmed)
        let matchedSheet: Worksheet | undefined;
        this.workBook.eachSheet((sheet) => {
            const name = sheet.name.trim().toLowerCase();
            if (!matchedSheet && (name === 'format' || name.includes('format') || name.includes('booking') || name.includes('upload'))) {
                matchedSheet = sheet;
            }
        });

        if (!matchedSheet) {
            matchedSheet = this.workBook.getWorksheet(1);
        }

        this.worksheet = matchedSheet as Worksheet;
        console.log(`[DataManager] Selected worksheet: "${this.worksheet.name}" (actualRowCount: ${this.worksheet.actualRowCount})`);

        this.initHeaders();
        this.listValidRows();
    }

    initHeaders() {
        const maxScanRows = Math.min(this.worksheet.actualRowCount, 30);
        let foundHeader = false;

        for (let i = 1; i <= maxScanRows; i++){
            const row=this.worksheet.getRow(i)
            let hasBookingCol = false;
            let hasSlNo = false;
            let matchCount = 0;

            row.eachCell({ includeEmpty: false }, (cell) => {
                const text = getCellValueFromCell(cell).toLowerCase();
                const alias = matchColumnAlias(text);
                if (alias === 'sl') hasSlNo = true;
                if (alias === 'booking_number') hasBookingCol = true;
                if (alias) matchCount++;
            });

            if (hasBookingCol || hasSlNo || matchCount >= 1) {
                this.tableDataStartsAt=i+1
                foundHeader = true;

                row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                    const rawText = getCellValueFromCell(cell);
                    const colAlias = matchColumnAlias(rawText);
                    if (colAlias) {
                        this.headers[colAlias] = colNumber;
                    }
                })
                break
            }
        }

        console.log("[DataManager] Detected Headers:", this.headers);

        if (!foundHeader || Object.keys(this.headers).length === 0) {
            console.warn(`[DataManager] Warning: Header row could not be identified in sheet "${this.worksheet.name}". Inspecting row 1:`);
            const row1 = this.worksheet.getRow(1);
            row1.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                console.log(`[DataManager]   Col ${colNumber}: "${getCellValueFromCell(cell)}"`);
            });
        }
    }

    listValidRows() {
        const bookingCol = this.headers['booking_number'];
        const poCol = this.headers['po'];
        const modelCol = this.headers['model'];

        if (!bookingCol && (!poCol || !modelCol)) {
            console.error("[DataManager] Critical: Neither 'Booking Number' nor 'PO'/'Model' column headers were found in the Excel sheet!");
            return;
        }

        for (let i=this.tableDataStartsAt;i<=this.worksheet.actualRowCount;i++) {
            const bookingNum=bookingCol ? getCellValueFromCell(this.worksheet.getCell(i, bookingCol)) : '';
            const model=modelCol ? getCellValueFromCell(this.worksheet.getCell(i, modelCol)) : '';
            const po=poCol ? getCellValueFromCell(this.worksheet.getCell(i, poCol)) : '';

            if (!isEmpty(bookingNum) || (!isEmpty(model) && !isEmpty(po))) {
                const groupRows: number[] = [i];

                while (i + 1 <= this.worksheet.actualRowCount) {
                    try {
                        const nextBooking = bookingCol ? getCellValueFromCell(this.worksheet.getCell(i + 1, bookingCol)) : '';
                        const nextModel = modelCol ? getCellValueFromCell(this.worksheet.getCell(i + 1, modelCol)) : '';
                        const nextPO = poCol ? getCellValueFromCell(this.worksheet.getCell(i + 1, poCol)) : '';

                        if (bookingCol && !isEmpty(bookingNum)) {
                            if (!isEmpty(nextBooking) && nextBooking.trim().toLowerCase() === bookingNum.trim().toLowerCase()) {
                                i++;
                                groupRows.push(i);
                            } else {
                                break;
                            }
                        } else {
                            if (!isEmpty(nextModel) && nextModel.trim().toLowerCase() === model.trim().toLowerCase() && nextPO.trim().toLowerCase() === po.trim().toLowerCase()) {
                                i++;
                                groupRows.push(i);
                            } else {
                                break;
                            }
                        }
                    } catch (error) {
                        break
                    }
                }
                if(groupRows.length>0){
                    this.validRows.push(groupRows)
                }
            }
           
        }
        // console.log(this.validRows)
    }

    private _getData(row:number):IDataFormExcel{
        const rowObj: any={}
        for (const key in this.headers){
            const colIndex = this.headers[key];
            if (!colIndex) continue;
            const cell = this.worksheet.getCell(row, colIndex);
            rowObj[key] = getCellValueFromCell(cell);
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
            const po = typeof item === 'object' ? (item.po || bookingNumber) : bookingNumber;
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