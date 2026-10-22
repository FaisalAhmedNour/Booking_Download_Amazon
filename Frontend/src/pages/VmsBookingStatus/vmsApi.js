import axios from 'axios';
import moment from 'moment';

const STORAGE_KEYS = {
    TOKEN: 'centuryvms_bearer_token',
    SUMMARY_URL: 'centuryvms_status_summary_url',
    GRID_URL_TEMPLATE: 'centuryvms_grid_url_template',
    SAVED_SUMMARY: 'centuryvms_saved_status_summary',
    SAVED_GRID: 'centuryvms_saved_grid_data',
    SAVED_STATUS: 'centuryvms_active_status'
};

export const DEFAULT_URLS = {
    PAGE_URL: 'https://www.centuryvms.com/#/pagelayout?moduleCd=Vob&configName=VobVendorOnlineBookingStatusRtn',
    SUMMARY_API_URL: 'https://apidr.centuryvms.com/api/Vob/Vob/GetVendorOnlineBookingStatusRtn?moduleCd=Vob&configName=VobVendorOnlineBookingStatusRtn',
    GRID_API_URL_TEMPLATE: 'https://apidr.centuryvms.com/api/Vob/Vob/GetVendorOnlineBookingStatusRtnGrid?whereClause=status%20=%20%27{STATUS}%27&moduleCd=Vob&configName=VobVendorOnlineBookingStatusRtn'
};

export const getStoredToken = () => {
    try {
        const directToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (directToken && directToken.trim()) return directToken.trim();

        // Check sessionStorage for Century VMS oidc token if opened in same domain/engine
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.includes('user:') || key.includes('oidc.user:'))) {
                try {
                    const data = JSON.parse(sessionStorage.getItem(key));
                    if (data?.access_token) return data.access_token;
                } catch {
                    // Ignore parsing error
                }
            }
        }
    } catch {
        // LocalStorage access restriction fallback
    }
    return '';
};

export const setStoredToken = (token) => {
    try {
        if (token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, token.trim());
        } else {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
        }
    } catch (e) {
        console.error('Failed to save token to localStorage', e);
    }
};

export const getStoredSummaryUrl = () => {
    try {
        return localStorage.getItem(STORAGE_KEYS.SUMMARY_URL) || DEFAULT_URLS.SUMMARY_API_URL;
    } catch {
        return DEFAULT_URLS.SUMMARY_API_URL;
    }
};

export const setStoredSummaryUrl = (url) => {
    try {
        localStorage.setItem(STORAGE_KEYS.SUMMARY_URL, url);
    } catch {
        // Ignore
    }
};

export const getStoredGridUrlTemplate = () => {
    try {
        return localStorage.getItem(STORAGE_KEYS.GRID_URL_TEMPLATE) || DEFAULT_URLS.GRID_API_URL_TEMPLATE;
    } catch {
        return DEFAULT_URLS.GRID_API_URL_TEMPLATE;
    }
};

export const setStoredGridUrlTemplate = (url) => {
    try {
        localStorage.setItem(STORAGE_KEYS.GRID_URL_TEMPLATE, url);
    } catch {
        // Ignore
    }
};

export const buildGridUrl = (status, template = null) => {
    const tmpl = template || getStoredGridUrlTemplate();
    const encodedWhereClause = encodeURIComponent(`status = '${status}'`);
    if (tmpl.includes('{STATUS}')) {
        return tmpl.replace('{STATUS}', encodeURIComponent(status));
    }
    if (tmpl.includes('whereClause=')) {
        return tmpl.replace(/whereClause=[^&]*/, `whereClause=${encodedWhereClause}`);
    }
    const separator = tmpl.includes('?') ? '&' : '?';
    return `${tmpl}${separator}whereClause=${encodedWhereClause}&moduleCd=Vob&configName=VobVendorOnlineBookingStatusRtn`;
};

export const normalizeStatus = (str) => {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/booking/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

const detectPayloadType = (firstItem) => {
    if (!firstItem || typeof firstItem !== 'object') {
        return { isStatusSummary: false, isGridBookings: false };
    }
    const isGridBookings = Boolean(
        firstItem.booking_key ||
        firstItem.booking_key_for_export ||
        firstItem.comp_cd ||
        firstItem.vendor_cd ||
        firstItem.customer_booking_number ||
        firstItem.customBookingId ||
        firstItem.planned_vsl ||
        firstItem.modify_by ||
        firstItem.CreatedBy
    );

    const isStatusSummary = !isGridBookings && Boolean(
        firstItem._type === 'status_summary' ||
        typeof firstItem.status_count === 'number' ||
        ('status_count' in firstItem && !('booking_key' in firstItem))
    );

    return { isStatusSummary, isGridBookings };
};

export const parseVmsResponse = (raw) => {
    if (!raw) return null;
    let data = raw;
    if (typeof raw === 'string') {
        try {
            data = JSON.parse(raw);
        } catch (e) {
            throw new Error(`Invalid JSON format: ${e.message}`);
        }
    }

    if (Array.isArray(data)) {
        const { isStatusSummary, isGridBookings } = detectPayloadType(data[0]);
        return { isArray: true, items: data, raw: data, isStatusSummary, isGridBookings };
    }

    // Check TableData (used by UIC Engine LocalCom)
    if (Array.isArray(data.TableData)) {
        const { isStatusSummary, isGridBookings } = detectPayloadType(data.TableData[0]);
        return { items: data.TableData, raw: data, isStatusSummary, isGridBookings };
    }

    if (Array.isArray(data.GridDataTable)) {
        const { isStatusSummary, isGridBookings } = detectPayloadType(data.GridDataTable[0]);
        return {
            isStatusSummary,
            isGridBookings,
            items: data.GridDataTable,
            raw: data
        };
    }

    if (Array.isArray(data.data)) {
        const { isStatusSummary, isGridBookings } = detectPayloadType(data.data[0]);
        return { items: data.data, raw: data, isStatusSummary, isGridBookings };
    }

    if (Array.isArray(data.items)) {
        return { items: data.items, raw: data };
    }

    if (Array.isArray(data.ResultData)) {
        return { items: data.ResultData, raw: data };
    }

    if (data.GridDataSet) {
        return { items: data.GridDataSet, raw: data };
    }

    return { raw: data, items: [] };
};

export const fetchVmsStatusSummary = async (options = {}) => {
    const token = (options.token || getStoredToken() || '').trim();
    const url = options.url || getStoredSummaryUrl();

    const headers = {
        'Accept': 'application/json, text/plain, */*'
    };
    if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    try {
        const response = await axios.get(url, {
            headers,
            timeout: 30000
        });

        const parsed = parseVmsResponse(response.data);
        return {
            success: true,
            data: response.data,
            parsed,
            url
        };
    } catch (error) {
        let errorMsg = error.message;
        let isCorsOrNetwork = false;

        if (error.response) {
            errorMsg = `Status ${error.response.status}: ${error.response.data?.Message || error.response.statusText || 'Server Error'}`;
        } else if (error.request) {
            isCorsOrNetwork = true;
            errorMsg = 'Network or CORS policy restriction prevented the browser from reaching Century VMS API directly.';
        }

        return {
            success: false,
            error: errorMsg,
            isCorsOrNetwork,
            url,
            rawError: error
        };
    }
};

export const fetchVmsGridData = async (status, options = {}) => {
    const token = (options.token || getStoredToken() || '').trim();
    const url = buildGridUrl(status, options.template);

    const headers = {
        'Accept': 'application/json, text/plain, */*'
    };
    if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    try {
        const response = await axios.get(url, {
            headers,
            timeout: 60000
        });

        const parsed = parseVmsResponse(response.data);
        return {
            success: true,
            data: response.data,
            parsed,
            status,
            url
        };
    } catch (error) {
        let errorMsg = error.message;
        let isCorsOrNetwork = false;

        if (error.response) {
            errorMsg = `Status ${error.response.status}: ${error.response.data?.Message || error.response.statusText || 'Server Error'}`;
        } else if (error.request) {
            isCorsOrNetwork = true;
            errorMsg = 'Network or CORS policy restriction prevented the browser from reaching Century VMS API directly.';
        }

        return {
            success: false,
            error: errorMsg,
            isCorsOrNetwork,
            status,
            url,
            rawError: error
        };
    }
};

export const formatVmsDate = (dateVal, format = 'DD-MMM-YYYY') => {
    if (!dateVal) return '-';
    const m = moment(dateVal);
    if (!m.isValid()) return String(dateVal);
    return m.format(format);
};

export const getStatusColorTheme = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'all') {
        return {
            bg: 'bg-slate-50',
            text: 'text-slate-800',
            border: 'border-slate-300',
            badge: 'bg-slate-800 text-white border-slate-700',
            dot: 'bg-slate-700',
            bar: 'bg-slate-700',
            hover: 'hover:border-slate-400 hover:bg-slate-100',
            selectedBg: 'bg-slate-900 text-white shadow-md'
        };
    }
    if (s.includes('draft')) {
        return {
            bg: 'bg-amber-50',
            text: 'text-amber-800',
            border: 'border-amber-200',
            badge: 'bg-amber-100 text-amber-800 border-amber-300',
            dot: 'bg-amber-500',
            bar: 'bg-amber-500',
            hover: 'hover:border-amber-400 hover:bg-amber-100/50',
            selectedBg: 'bg-amber-600 text-white shadow-md'
        };
    }
    if (s.includes('sent')) {
        return {
            bg: 'bg-blue-50',
            text: 'text-blue-800',
            border: 'border-blue-200',
            badge: 'bg-blue-100 text-blue-800 border-blue-300',
            dot: 'bg-blue-500',
            bar: 'bg-blue-500',
            hover: 'hover:border-blue-400 hover:bg-blue-100/50',
            selectedBg: 'bg-blue-600 text-white shadow-md'
        };
    }
    if (s.includes('confirmed')) {
        return {
            bg: 'bg-emerald-50',
            text: 'text-emerald-800',
            border: 'border-emerald-200',
            badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            dot: 'bg-emerald-500',
            bar: 'bg-emerald-500',
            hover: 'hover:border-emerald-400 hover:bg-emerald-100/50',
            selectedBg: 'bg-emerald-600 text-white shadow-md'
        };
    }
    if (s.includes('declined')) {
        return {
            bg: 'bg-rose-50',
            text: 'text-rose-800',
            border: 'border-rose-200',
            badge: 'bg-rose-100 text-rose-800 border-rose-300',
            dot: 'bg-rose-500',
            bar: 'bg-rose-500',
            hover: 'hover:border-rose-400 hover:bg-rose-100/50',
            selectedBg: 'bg-rose-600 text-white shadow-md'
        };
    }
    if (s.includes('void')) {
        return {
            bg: 'bg-purple-50',
            text: 'text-purple-800',
            border: 'border-purple-200',
            badge: 'bg-purple-100 text-purple-800 border-purple-300',
            dot: 'bg-purple-500',
            bar: 'bg-purple-500',
            hover: 'hover:border-purple-400 hover:bg-purple-100/50',
            selectedBg: 'bg-purple-600 text-white shadow-md'
        };
    }
    return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        border: 'border-gray-200',
        badge: 'bg-gray-100 text-gray-800 border-gray-300',
        dot: 'bg-gray-500',
        bar: 'bg-gray-500',
        hover: 'hover:border-gray-400 hover:bg-gray-100/50',
        selectedBg: 'bg-gray-700 text-white shadow-md'
    };
};
