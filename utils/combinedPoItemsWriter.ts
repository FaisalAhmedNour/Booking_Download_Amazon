import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

/** Columns that always come first in the combined PO items sheet. */
const FIXED_HEADERS = ['Booking Number', 'PO Number'];
const ITEMS_SHEET = 'All PO Items';
const BOOKINGS_SHEET = 'Bookings';
const BOOKINGS_HEADERS = ['SL', 'Booking Number', 'PO', 'Result', 'PO Item Rows', 'Source', 'Message', 'Processed At'];

export type CombinedSaveResult = {
    ok: boolean;
    filePath: string;
    error?: string;
    /** True when the file is locked (usually open in Excel). */
    locked?: boolean;
};

export type BookingResult = {
    bookingKey: string;
    po?: string;
    success: boolean;
    poItemRows: number;
    source?: string;
    message?: string;
};

function timestamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function isLockError(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

/**
 * Builds the run's combined PO items workbook and rewrites it on disk after every
 * booking, so the data survives if the process is stopped or killed.
 *
 * Each save writes `<file>.partial` and then renames it over the real file, so a
 * kill during a save leaves the previous complete version in place.
 */
export class CombinedPoItemsWriter {
    private readonly dir: string;
    private readonly baseName: string;
    private currentPath: string;
    private readonly rows: Record<string, unknown>[] = [];
    private readonly headers = new Set<string>(FIXED_HEADERS);
    private readonly bookings = new Map<string, BookingResult & { processedAt: Date }>();

    constructor(downloadDir: string, now: Date = new Date()) {
        this.dir = downloadDir;
        this.baseName = `Combined_PO_Items_${timestamp(now)}`;
        this.currentPath = path.join(this.dir, `${this.baseName}.xlsx`);
    }

    get filePath(): string {
        return this.currentPath;
    }

    get fileName(): string {
        return path.basename(this.currentPath);
    }

    /** Number of PO item rows collected so far. */
    get rowCount(): number {
        return this.rows.length;
    }

    /** Number of bookings that contributed PO item rows. */
    get bookingsWithItems(): number {
        let n = 0;
        this.bookings.forEach(b => { if (b.poItemRows > 0) n++; });
        return n;
    }

    /** Adds one booking's PO item rows (each already carrying 'Booking Number' and 'PO Number'). */
    addPoItemRows(rows: Record<string, unknown>[]) {
        for (const row of rows) {
            Object.keys(row).forEach(k => this.headers.add(k));
            this.rows.push(row);
        }
    }

    /** Records the outcome of a booking for the 'Bookings' sheet (last call per booking wins). */
    recordBooking(result: BookingResult) {
        const key = result.bookingKey.trim().toUpperCase();
        if (!key) return;
        this.bookings.set(key, { ...result, processedAt: new Date() });
    }

    private buildWorkbook(): XLSX.WorkBook {
        const wb = XLSX.utils.book_new();

        const headersList = Array.from(this.headers);
        const itemsSheet = XLSX.utils.json_to_sheet(this.rows, { header: headersList });
        const sample = this.rows.slice(0, 100);
        itemsSheet['!cols'] = headersList.map(h => {
            let max = h.length;
            for (const r of sample) {
                const len = String(r[h] ?? '').length;
                if (len > max) max = len;
            }
            return { wch: Math.min(Math.max(max + 3, 12), 40) };
        });
        XLSX.utils.book_append_sheet(wb, itemsSheet, ITEMS_SHEET);

        const bookingRows = Array.from(this.bookings.values()).map((b, i) => ({
            'SL': i + 1,
            'Booking Number': b.bookingKey,
            'PO': b.po || '',
            'Result': b.success ? 'Success' : 'Failed',
            'PO Item Rows': b.poItemRows,
            'Source': b.source || '',
            'Message': b.message || '',
            'Processed At': b.processedAt.toLocaleString(),
        }));
        const bookingsSheet = XLSX.utils.json_to_sheet(bookingRows, { header: BOOKINGS_HEADERS });
        bookingsSheet['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 24 }, { wch: 9 }, { wch: 13 }, { wch: 11 }, { wch: 60 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, bookingsSheet, BOOKINGS_SHEET);

        return wb;
    }

    /** Writes the workbook safely (temp file + rename). Never throws. */
    save(): CombinedSaveResult {
        const target = this.currentPath;
        const tmp = `${target}.partial`;
        try {
            if (!fs.existsSync(this.dir)) {
                fs.mkdirSync(this.dir, { recursive: true });
            }
            const buffer = XLSX.write(this.buildWorkbook(), { type: 'buffer', bookType: 'xlsx' });
            fs.writeFileSync(tmp, buffer);
            fs.renameSync(tmp, target);
            return { ok: true, filePath: target };
        } catch (err) {
            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
            return {
                ok: false,
                filePath: target,
                locked: isLockError(err),
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Final save at the end of the run. If the file is still locked (open in Excel),
     * saves to `<name>_1.xlsx` (or the next free number) instead.
     */
    saveFinal(): CombinedSaveResult {
        let result = this.save();
        if (!result.ok && result.locked) {
            for (let n = 1; n <= 20; n++) {
                const candidate = path.join(this.dir, `${this.baseName}_${n}.xlsx`);
                if (fs.existsSync(candidate)) continue;
                this.currentPath = candidate;
                result = this.save();
                break;
            }
        }
        return result;
    }
}
