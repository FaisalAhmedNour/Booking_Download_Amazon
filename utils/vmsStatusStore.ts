import { AppCreator } from "./App";

/** Base path of the UIC backend API that stores Century VMS booking status rows. */
const API_BASE = "/process/CenturyVmsStatus";
/** Rows per save request (backend accepts up to 1000). */
const SAVE_CHUNK_SIZE = 500;

type ApiBody = { success?: boolean; message?: string; [key: string]: unknown };

export type DownloadResult = {
    poItemFile?: string;
    pdfFile?: string;
    downloadSuccess?: boolean;
    downloadMessage?: string;
};

/**
 * Saves pulled booking status rows and download results to the UIC backend through
 * the engine proxy, so the "VMS Booking Status" tab can reload them later.
 *
 * Saving is best-effort: failures never stop the automation. The first failure shows
 * one warning in the message table; later failures are only logged.
 */
export class VmsStatusStore {
    private warned = false;
    /** False once any save in this run failed. */
    allSaved = true;

    constructor(private readonly app: AppCreator) {}

    private get proxy() {
        return this.app.LocalCom?.Proxy;
    }

    private async request(method: "post" | "patch", url: string, payload: unknown): Promise<{ ok: boolean; status?: number; body?: ApiBody }> {
        if (!this.proxy) {
            return { ok: false };
        }
        try {
            const resp = method === "post"
                ? await this.proxy.post(url, payload)
                : await this.proxy.patch(url, payload);
            const body = (resp?.data ?? {}) as ApiBody;
            return { ok: resp?.status < 400 && body.success === true, status: resp?.status, body };
        } catch (err) {
            console.warn(`[VmsStatusStore] ${method.toUpperCase()} ${url} failed:`, err instanceof Error ? err.message : err);
            return { ok: false };
        }
    }

    private async warnOnce(detail: string) {
        this.allSaved = false;
        console.warn(`[VmsStatusStore] ${detail}`);
        if (this.warned) return;
        this.warned = true;
        try {
            await this.app.LocalCom.sendData(undefined, [{
                channel: this.app.LocalCom.progress.channel,
                type: 'w',
                title: 'Not Saved to Server',
                message: `Couldn't save booking data to the server, so it is visible in this session only. (${detail})`
            }]);
        } catch { /* engine unreachable */ }
    }

    /** Saves pulled grid rows (any count; sent in chunks). Returns true if all chunks were saved. */
    async saveRows(rows: unknown[], pulledAt: string): Promise<boolean> {
        let ok = true;
        for (let i = 0; i < rows.length; i += SAVE_CHUNK_SIZE) {
            const chunk = rows.slice(i, i + SAVE_CHUNK_SIZE);
            const res = await this.request("post", `${API_BASE}/bulk`, { rows: chunk, pulledAt });
            if (!res.ok) {
                ok = false;
                await this.warnOnce(res.body?.message || (res.status ? `server returned ${res.status}` : 'no response'));
            }
        }
        return ok;
    }

    /** Marks bookings not seen since `runStartedAt` as stale. Call only after a complete pull. */
    async finalize(runStartedAt: string): Promise<boolean> {
        const res = await this.request("post", `${API_BASE}/finalize`, { runStartedAt });
        if (!res.ok) {
            await this.warnOnce(res.body?.message || 'could not finalise the pull');
            return false;
        }
        console.log(`[VmsStatusStore] Pull finalised, ${res.body?.markedStale ?? 0} booking(s) marked stale.`);
        return true;
    }

    /**
     * Saves the download result of one booking. A 404 (booking never pulled, e.g. from
     * an Excel run) is expected and ignored.
     */
    async saveDownloadResult(bookingKey: string, result: DownloadResult): Promise<void> {
        if (!bookingKey) return;
        const res = await this.request("patch", `${API_BASE}/${encodeURIComponent(bookingKey)}/download`, result);
        if (!res.ok && res.status !== 404) {
            await this.warnOnce(res.body?.message || (res.status ? `server returned ${res.status}` : 'no response'));
        }
    }
}
