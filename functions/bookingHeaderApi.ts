import { AppCreator } from "../utils/App";
import { CenturyAPIProvider } from "../utils/century.api.provider";

export type BookingHeaderResult =
    | { ok: true; status: string; created: string }
    | { ok: false; message: string };

/**
 * Reads a booking's status ("Sent", "Confirmed"...) and created date from Century VMS's
 * GetBookingHeader API, so the booking page does not have to be opened. Fails (and the caller
 * opens the page instead) if the call fails, returns another booking, or has no status.
 */
export async function fetchBookingHeaderViaApi(app: AppCreator, bookingKey: string, compCd: string): Promise<BookingHeaderResult> {
    try {
        if (!compCd) return { ok: false, message: 'Company code is missing.' };
        const api = new CenturyAPIProvider(await app.createSession());
        const res = await api.getBookingHeader(bookingKey, compCd);
        if (!res.success || !res.header) {
            return { ok: false, message: `Booking header API failed: ${res.message || 'no response'}` };
        }
        const header = res.header;
        const returnedKey = String(header.booking_key ?? '').trim().toUpperCase();
        if (returnedKey !== bookingKey.trim().toUpperCase()) {
            return { ok: false, message: `Booking header API returned booking "${header.booking_key ?? ''}", not ${bookingKey}.` };
        }
        const status = String(header.BOOKING_STATUS_DESC ?? '').trim();
        if (!status) {
            return { ok: false, message: 'Booking header API returned no booking status.' };
        }
        return { ok: true, status, created: String(header.CREATE_DATE ?? '').trim() };
    } catch (err: any) {
        return { ok: false, message: `Booking header API failed: ${err?.message || err}` };
    }
}
