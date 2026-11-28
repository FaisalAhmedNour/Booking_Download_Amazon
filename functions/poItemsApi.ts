import { AppCreator } from "../utils/App";
import { CenturyAPIProvider } from "../utils/century.api.provider";

/**
 * Columns of the PO Items grid export, in the export's order, with the GetItemDetail field
 * each one comes from. Verified against the grid's Export file on 10 bookings (564 rows):
 * same rows, same order, identical values once dates are converted.
 */
export const PO_ITEM_API_COLUMNS: ReadonlyArray<{ header: string; field: string; date?: boolean }> = [
    { header: 'Serial Number', field: 'serial_no' },
    { header: 'PO #', field: 'po' },
    { header: 'ASIN #', field: 'item' },
    { header: 'Model #', field: 'pd_style' },
    { header: 'ASIN FC', field: 'dest' },
    { header: 'Add/Edit Country/Region of Origin (COO)', field: 'goodsorg' },
    { header: 'Ordered Units', field: 'pd_units_ordered_at' },
    { header: 'Booked Units', field: 'units' },
    { header: 'Unit of Measure', field: 'carton_uom' },
    { header: 'Booked Units in other booking', field: 'unitsinotherbooking' },
    { header: 'Booked Cartons', field: 'cartons' },
    { header: 'Net Weight (KG)', field: 'net_weight' },
    { header: 'Booked Volume', field: 'volume' },
    { header: 'Volume UOM', field: 'volume_uom' },
    { header: 'Booked Weight', field: 'weight' },
    { header: 'Weight UOM', field: 'weight_uom' },
    { header: 'Last Ship Date', field: 'duedate', date: true },
    { header: 'Estimated Delivery Date', field: 'est_rcvd_date', date: true },
    { header: 'PO Item Description', field: 'pd_item_desc' },
    { header: 'Carrier Item Description', field: 'carrier_item_description' },
    { header: 'Stuffing Location Name', field: 'stuffing_location_cd' },
    { header: 'Manufacturer Name', field: 'manufacturer_cd' },
    { header: 'Trade Agreement', field: 'gsp_form_a' },
    { header: 'Shipping Marks', field: 'shippingmarks' },
    { header: 'HTS Code', field: 'BookingHtsCode' },
    { header: 'Inspection PO Approve', field: 'po_approve' },
    { header: 'Inspection Approve', field: 'item_approve' },
    { header: 'Cargo Type ID', field: 'book_dg_id' },
    { header: 'Cargo Type', field: 'dg_vendor_ref_no' },
    { header: 'Item Certificate Approved', field: 'itemcertificateapproved' },
    { header: 'Remarks in FCR', field: 'fcr_remarks' },
    { header: 'Sort', field: 'pd_item_division' },
];

/** Columns holding dates (as Excel date numbers, like the grid export). */
export const PO_ITEM_DATE_HEADERS: readonly string[] = PO_ITEM_API_COLUMNS.filter(c => c.date).map(c => c.header);

/**
 * Converts an API date ("2026-11-18T00:00:00" or "/Date(1790000000000)/") to the Excel
 * date number the grid export contains (46344 for 2026-11-18). Unreadable values are kept.
 */
export function toExcelDate(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value !== 'string') return value;
    const text = value.trim();
    const msDate = text.match(/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/);
    if (msDate) return Number(msDate[1]) / 86_400_000 + 25_569;
    // Date and time are read as written (no time-zone shift), as Excel shows them.
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!iso) return value;
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = iso;
    const days = Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 86_400_000 + 25_569;
    const dayFraction = (Number(h) * 3600 + Number(mi) * 60 + Number(s)) / 86_400;
    return days + dayFraction;
}

/** Turns GetItemDetail rows into rows with the grid export's headers, order and value formats. */
export function mapApiPoItems(apiRows: any[]): Record<string, unknown>[] {
    return apiRows.map(apiRow => {
        const row: Record<string, unknown> = {};
        for (const col of PO_ITEM_API_COLUMNS) {
            const value = apiRow?.[col.field];
            row[col.header] = col.date ? toExcelDate(value) : (value === null || value === undefined ? '' : value);
        }
        return row;
    });
}

export type ApiPoItemsResult =
    | { ok: true; rows: Record<string, unknown>[] }
    | { ok: false; message: string };

/**
 * Checks GetItemDetail rows before they are used. Fails (so the caller falls back to the grid
 * export) if there are no rows, a row belongs to another booking, a row has no PO #, or
 * Century no longer sends one of the mapped fields.
 */
export function validateApiPoItems(apiRows: any[], bookingKey: string): ApiPoItemsResult {
    if (apiRows.length === 0) {
        return { ok: false, message: 'Century VMS API returned no PO items.' };
    }
    const expected = bookingKey.trim().toUpperCase();
    const other = apiRows
        .map(r => String(r?.booking_key ?? '').trim().toUpperCase())
        .find(k => k && k !== expected);
    if (other) {
        return { ok: false, message: `Century VMS API returned items of booking ${other}, not ${bookingKey}.` };
    }
    const missing = PO_ITEM_API_COLUMNS.filter(c => !apiRows.some(r => r && c.field in r));
    if (missing.length > 0) {
        return {
            ok: false,
            message: `Century VMS API no longer sends ${missing.map(c => `"${c.header}" (${c.field})`).join(', ')}.`
        };
    }
    if (apiRows.some(r => !String(r?.po ?? '').trim())) {
        return { ok: false, message: 'Century VMS API returned a PO item without a PO #.' };
    }
    return { ok: true, rows: mapApiPoItems(apiRows) };
}

/**
 * Reads a booking's PO items from Century VMS's GetItemDetail API (the call the PO Items grid
 * itself uses) and returns them in the grid export's format. A new session is made from the
 * page's current access token each time, so a token refreshed by the portal is picked up.
 */
export async function fetchPoItemsViaApi(app: AppCreator, bookingKey: string, compCd: string): Promise<ApiPoItemsResult> {
    try {
        if (!compCd) return { ok: false, message: 'Company code is missing.' };
        const api = new CenturyAPIProvider(await app.createSession());
        const res = await api.getItemDetail(bookingKey, compCd);
        if (!res.success || !Array.isArray(res.rows)) {
            return { ok: false, message: `Century VMS API call failed: ${res.message || 'no response'}` };
        }
        return validateApiPoItems(res.rows, bookingKey);
    } catch (err: any) {
        return { ok: false, message: `Century VMS API call failed: ${err?.message || err}` };
    }
}
