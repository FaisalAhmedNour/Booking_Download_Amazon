import { useState, useEffect, useMemo, useRef } from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import TablePagination from '@mui/material/TablePagination';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

// Icons
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TuneIcon from '@mui/icons-material/Tune';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import KeyIcon from '@mui/icons-material/Key';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StopIcon from '@mui/icons-material/Stop';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CloseIcon from '@mui/icons-material/Close';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ClearIcon from '@mui/icons-material/Clear';

// Components from DownloadPO / Century VMS
import TimerSection from '../../Components/TimerSection';
import MessageTable from '../../Components/MessageTable';
import StickyInstructions from '../../Components/StickyInstructions/StickyInstructions';
import FormatDownload from '../DownloadPO/FormatDownload';
import SettingsMenu from '../Settings/SettingsMenu';

// Local modules
import {
    fetchVmsStatusSummary,
    fetchVmsGridData,
    formatVmsDate,
    getStatusColorTheme,
    getStoredToken,
    setStoredToken,
    getStoredSummaryUrl,
    setStoredSummaryUrl,
    getStoredGridUrlTemplate,
    setStoredGridUrlTemplate,
    DEFAULT_URLS,
    parseVmsResponse,
    normalizeStatus
} from './vmsApi';
import BookingDetailModal from './BookingDetailModal';
import PasteJsonModal from './PasteJsonModal';
import DownloadSelectedModal from './DownloadSelectedModal';
import exportToExcel from '../../Functions/exportToExcel';

// Safe row key extractor
const getRowKey = (row, fallbackIdx = 0) => {
    return row?.booking_key || row?.booking_key_for_export || row?.customer_booking_number || row?.customBookingId || row?.BookingKey || row?.booking_number || `row_${fallbackIdx}`;
};

// Robust payload unwrap helper
const extractPayloadItems = (dt) => {
    if (!dt) return [];
    if (Array.isArray(dt)) return dt;
    if (Array.isArray(dt.TableData)) return dt.TableData;
    if (Array.isArray(dt.GridDataTable)) return dt.GridDataTable;
    if (Array.isArray(dt.data)) return dt.data;
    if (Array.isArray(dt.items)) return dt.items;
    if (Array.isArray(dt.ResultData)) return dt.ResultData;
    if (typeof dt === 'object') {
        if (dt.data && typeof dt.data === 'object' && !Array.isArray(dt.data)) {
            return [dt.data];
        }
        return [dt];
    }
    return [];
};

export default function VmsBookingStatus() {
    // Status counts summary state (Initialized empty like Booking Correction tab)
    const [statusSummary, setStatusSummary] = useState([]);

    // Active status filter (defaults to ALL to show all pulled bookings)
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    // Grid bookings data state (Initialized empty like Booking Correction tab)
    const [gridData, setGridData] = useState([]);

    // Loading & errors
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [isLoadingGrid, setIsLoadingGrid] = useState(false);
    const [isBackendProcessing, setIsBackendProcessing] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [successBanner, setSuccessBanner] = useState(null);

    // Settings & Token
    const [showSettings, setShowSettings] = useState(false);
    const [token, setToken] = useState(() => getStoredToken());
    const [summaryUrl, setSummaryUrl] = useState(() => getStoredSummaryUrl());
    const [gridUrlTemplate, setGridUrlTemplate] = useState(() => getStoredGridUrlTemplate());

    // Modals
    const [detailBooking, setDetailBooking] = useState(null);
    const [pasteModalOpen, setPasteModalOpen] = useState(false);
    const [backendModalOpen, setBackendModalOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [isDownloadStarting, setIsDownloadStarting] = useState(false);
    const [currentProcessMode, setCurrentProcessMode] = useState(null);
    const currentProcessModeRef = useRef(null);

    // Backend process credentials (will always pull all statuses sequentially)
    const [backendCreds, setBackendCreds] = useState(() => ({
        userName: localStorage.getItem('centuryvms_saved_username') || '',
        password: ''
    }));

    // Table filters & search
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCompCd, setSelectedCompCd] = useState('ALL');
    const [selectedVendorCd, setSelectedVendorCd] = useState('ALL');

    // Table selection & pagination
    const [selectedRowKeys, setSelectedRowKeys] = useState(new Set());
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [isExporting, setIsExporting] = useState(false);
    const [copyNotification, setCopyNotification] = useState(null);

    // Engine & progress timer states (matching Booking Correction DownloadPO)
    const [engineStatus, setEngineStatus] = useState(null);
    const [chanel, setChanel] = useState('d');
    const [isExpandTimer, setIsExpandTimer] = useState(false);
    const [isExpandMiniTimer, setIsExpandMiniTimer] = useState(false);
    const [isExpandMessage, setIsExpandMessage] = useState(false);
    const [isExpandStatus, setIsExpandStatus] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [succeed, setSucceed] = useState(0);

    // Save status summary to localStorage on update
    useEffect(() => {
        try {
            if (statusSummary && Array.isArray(statusSummary)) {
                localStorage.setItem('centuryvms_saved_status_summary', JSON.stringify(statusSummary));
            }
        } catch {
            // Ignore
        }
    }, [statusSummary]);

    // Debounced & quota-safe save of grid data to localStorage
    useEffect(() => {
        if (!gridData || !Array.isArray(gridData) || gridData.length === 0) {
            return;
        }

        const timer = setTimeout(() => {
            try {
                // Safeguard against QuotaExceededError (localStorage max is ~5MB)
                const safeToStore = gridData.length > 2500 ? gridData.slice(0, 2500) : gridData;
                localStorage.setItem('centuryvms_saved_grid_data', JSON.stringify(safeToStore));
            } catch (err) {
                console.warn('[VmsBookingStatus] LocalStorage quota exceeded or error saving grid data:', err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [gridData]);

    // Listen to backend process IPC events
    useEffect(() => {
        const handleProcessStart = () => {
            if (currentProcessModeRef.current !== 'download_selected') {
                setGridData([]);
                setStatusSummary([]);
                setSelectedRowKeys(new Set());
                setPage(0);
            }
            setIsBackendProcessing(true);
            setIsExpandMiniTimer(true);
            setEngineStatus("Started");
        };

        const handleProcessStop = () => {
            setIsBackendProcessing(false);
            setIsExpandMiniTimer(false);
            setEngineStatus("Stopped");
        };

        const handleTableData = (dt) => {
            console.log('[onTableData received]', dt);
            if (!dt) return;

            const items = extractPayloadItems(dt);
            if (!items || items.length === 0) return;

            // 1. Check if payload contains status summary meta object
            const summaryMsg = items.find(it => it && it._type === 'status_summary');
            if (summaryMsg) {
                if (Array.isArray(summaryMsg.data)) {
                    const pureSummary = summaryMsg.data.filter(it => it && !it.booking_key && !it.booking_key_for_export && !it.comp_cd && !it.vendor_cd && !it.customer_booking_number);
                    setStatusSummary(pureSummary);
                }
                if (summaryMsg.token) {
                    setToken(summaryMsg.token);
                    setStoredToken(summaryMsg.token);
                }
                const nonSummary = items.filter(it => it && it._type !== 'status_summary');
                if (nonSummary.length === 0) return;
            }

            // 2. Check if items are status summary records (NEVER if they contain booking row attributes)
            const hasBookingIdentifiers = items.some(it => it && (
                it.booking_key || 
                it.booking_key_for_export || 
                it.comp_cd || 
                it.vendor_cd || 
                it.customer_booking_number ||
                it.modify_by ||
                it.CreatedBy
            ));

            if (!hasBookingIdentifiers && items.every(it => it && typeof it.status_count === 'number')) {
                setStatusSummary(prev => {
                    const map = new Map((prev || []).filter(s => s && !s.booking_key && !s.comp_cd).map(s => [normalizeStatus(s.status || s.Booking_Status), s]));
                    items.forEach(s => map.set(normalizeStatus(s.status || s.Booking_Status), s));
                    return Array.from(map.values());
                });
                return;
            }

            // 3. Check if payload items represent download execution results (from issueBooking download)
            const downloadItems = items.filter(it => it && (
                it.po_item_file !== undefined ||
                it.pdf_file !== undefined ||
                (it.Success !== undefined && it.booking_number)
            ));

            if (downloadItems.length > 0) {
                setGridData(prev => {
                    const rowMap = new Map((prev || []).map(r => [getRowKey(r), { ...r }]));
                    downloadItems.forEach(d => {
                        const bKey = String(d.booking_number || '').trim();
                        let matched = rowMap.get(bKey);
                        if (!matched) {
                            for (const [k, v] of rowMap.entries()) {
                                if (
                                    String(v.booking_key || '').trim() === bKey ||
                                    String(v.booking_key_for_export || '').trim() === bKey ||
                                    String(v.customer_booking_number || '').trim() === bKey
                                ) {
                                    matched = v;
                                    break;
                                }
                            }
                        }
                        if (matched) {
                            if (d.po_item_file) matched.po_item_file = d.po_item_file;
                            if (d.pdf_file) matched.pdf_file = d.pdf_file;
                            if (d.Success !== undefined) matched.download_success = d.Success;
                            if (d.Message) matched.download_message = d.Message;
                            if (d.Success !== undefined) matched.download_status = d.Success ? 'Success' : 'Failed';
                            if (d.po_status) matched.status = d.po_status;
                        }
                    });
                    return Array.from(rowMap.values());
                });
            }

            // 4. Process booking grid rows (pull mode streaming)
            const newRows = items
                .filter(r => r && typeof r === 'object' && r._type !== 'status_summary' && r.po_item_file === undefined && r.pdf_file === undefined)
                .map((r, idx) => {
                    const key = getRowKey(r, idx);
                    const rawStatus = r.status || (r.Booking_Status ? r.Booking_Status.replace(/booking/i, '').trim() : '') || 'Draft';
                    return {
                        ...r,
                        booking_key: key,
                        status: rawStatus
                    };
                });

            if (newRows.length > 0 && downloadItems.length === 0) {
                setGridData(prev => {
                    const existingMap = new Map((prev || []).map(r => [getRowKey(r), r]));
                    newRows.forEach(r => existingMap.set(getRowKey(r), r));
                    return Array.from(existingMap.values());
                });
            }
        };

        window?.engine?.onProcessStart?.(handleProcessStart);
        window?.engine?.onProcessStop?.(handleProcessStop);
        window?.engine?.onTableData?.(handleTableData);

        return () => {
            window?.engine?.offProcessStart?.(handleProcessStart);
            window?.engine?.offProcessStop?.(handleProcessStop);
            window?.engine?.offTableData?.(handleTableData);
        };
    }, []);

    // Handle token and URL settings save
    const handleSaveSettings = () => {
        setStoredToken(token);
        setStoredSummaryUrl(summaryUrl);
        setStoredGridUrlTemplate(gridUrlTemplate);
        setShowSettings(false);
        setSuccessBanner('API settings and authorization token saved successfully.');
        setTimeout(() => setSuccessBanner(null), 3000);
    };

    // Step 1: Pull status summary from VMS API
    const handlePullStatusSummary = async () => {
        setIsLoadingSummary(true);
        setApiError(null);
        setSuccessBanner(null);

        const res = await fetchVmsStatusSummary({ token, url: summaryUrl });
        setIsLoadingSummary(false);

        if (res.success && res.parsed?.items?.length) {
            setStatusSummary(res.parsed.items);
            setSuccessBanner(`Pulled status summary with ${res.parsed.items.length} booking status categories!`);
            setTimeout(() => setSuccessBanner(null), 4000);
        } else {
            setApiError({
                title: 'Failed to Pull Status Summary from Century VMS',
                message: res.error,
                url: res.url,
                isCorsOrNetwork: res.isCorsOrNetwork
            });
        }
    };

    // Step 2: Pull Grid Data via API (supports ALL statuses sequentially or single status)
    const handlePullGridData = async (statusToFetch = null) => {
        const targetStatus = statusToFetch || selectedStatus;
        if (!targetStatus) return;

        setIsLoadingGrid(true);
        setApiError(null);
        setSuccessBanner(null);

        if (targetStatus === 'ALL') {
            const statusesToFetch = statusSummary.length > 0 
                ? statusSummary.map(s => s.status || s.Booking_Status).filter(Boolean)
                : ['Draft', 'Sent', 'Confirmed', 'Declined', 'Void'];

            let allRows = [];
            let errors = [];

            for (const st of statusesToFetch) {
                const res = await fetchVmsGridData(st, { token, template: gridUrlTemplate });
                if (res.success && res.parsed?.items) {
                    const normalized = res.parsed.items.map((r, idx) => ({
                        ...r,
                        status: r.status || st,
                        booking_key: getRowKey(r, idx)
                    }));
                    allRows = [...allRows, ...normalized];
                } else if (res.error) {
                    errors.push(`${st}: ${res.error}`);
                }
            }

            setIsLoadingGrid(false);
            if (allRows.length > 0) {
                setGridData(allRows);
                setSelectedRowKeys(new Set());
                setPage(0);
                setSuccessBanner(`Fetched ${allRows.length} total bookings across ${statusesToFetch.length} status categories!`);
                setTimeout(() => setSuccessBanner(null), 4000);
            } else if (errors.length > 0) {
                setApiError({
                    title: 'Failed to Fetch Grid Data for All Statuses',
                    message: errors.join('\n')
                });
            }
            return;
        }

        const res = await fetchVmsGridData(targetStatus, {
            token,
            template: gridUrlTemplate
        });
        setIsLoadingGrid(false);

        if (res.success && res.parsed?.items) {
            const normalized = res.parsed.items.map((r, idx) => ({
                ...r,
                status: r.status || targetStatus,
                booking_key: getRowKey(r, idx)
            }));
            setGridData(prev => {
                const otherStatuses = (prev || []).filter(r => normalizeStatus(r.status) !== normalizeStatus(targetStatus));
                return [...otherStatuses, ...normalized];
            });
            setSelectedRowKeys(new Set());
            setPage(0);
            setSuccessBanner(`Fetched ${normalized.length} bookings for status "${targetStatus}"!`);
            setTimeout(() => setSuccessBanner(null), 4000);
        } else {
            setApiError({
                title: `Failed to Fetch Grid Data for "${targetStatus}"`,
                message: res.error,
                url: res.url,
                isCorsOrNetwork: res.isCorsOrNetwork
            });
        }
    };

    // Status Card Click (Toggles filtering between that status and ALL)
    const handleSelectStatus = (statusName) => {
        setSelectedStatus(prev => (normalizeStatus(prev) === normalizeStatus(statusName) ? 'ALL' : statusName));
        setPage(0);
    };

    // Start backend Edge process (pulls all statuses sequentially)
    const handleStartBackendProcess = async (e) => {
        if (e) e.preventDefault();
        if (!backendCreds.userName.trim() || !backendCreds.password.trim()) {
            setApiError({
                title: 'Credentials Required',
                message: 'Please provide both Username and Password to start the Edge automation process.'
            });
            return;
        }

        try {
            currentProcessModeRef.current = 'pull_status';
            setCurrentProcessMode('pull_status');
            localStorage.setItem('centuryvms_saved_username', backendCreds.userName);
            setBackendModalOpen(false);
            setIsBackendProcessing(true);
            setSuccessBanner('Starting backend Edge process to sequentially pull all booking statuses...');
            
            // Clean table and reset selection & pagination (matching Booking Correction tab)
            setGridData([]);
            setStatusSummary([]);
            setSelectedRowKeys(new Set());
            setPage(0);
            setEngineStatus("Started");
            setIsBackendProcessing(true);
            setIsExpandMiniTimer(true);

            const res = await window?.engine?.startProcess({
                mode: 'pull_status',
                userName: backendCreds.userName,
                password: backendCreds.password,
                settings: {
                    status: 'ALL'
                }
            });

            if (res?.success === false) {
                setIsBackendProcessing(false);
                setIsExpandMiniTimer(false);
                setEngineStatus("Start Failed");
                setApiError({
                    title: 'Process Launch Failed',
                    message: res?.message || 'UIC Engine could not launch the process.'
                });
            }
        } catch (err) {
            setIsBackendProcessing(false);
            setIsExpandMiniTimer(false);
            setEngineStatus("Start Failed");
            setApiError({
                title: 'Process Launch Error',
                message: err?.message || String(err)
            });
        }
    };

    // Open Download Modal for selected bookings
    const handleOpenDownloadModal = () => {
        if (selectedRowKeys.size === 0) {
            if (filteredRows.length > 0) {
                setApiError({
                    title: 'Selection Required',
                    message: 'Please select one or more bookings using the checkboxes in the table to start downloading.'
                });
            } else {
                setApiError({
                    title: 'No Data Available',
                    message: 'There are no bookings available to download. Please pull booking data first.'
                });
            }
            return;
        }
        setDownloadModalOpen(true);
    };

    // Quick selection helpers
    const handleSelectAllFiltered = () => {
        const next = new Set(selectedRowKeys);
        filteredRows.forEach((row, i) => {
            const k = getRowKey(row, i);
            if (k) next.add(k);
        });
        setSelectedRowKeys(next);
    };

    const handleClearSelection = () => {
        setSelectedRowKeys(new Set());
    };

    // Start batch download of selected bookings via backend engine
    const handleStartBookingDownload = async (config) => {
        const { userName, password, companyCode, downloadDir, downloadPoItems, downloadPdf, selectedRows } = config;

        try {
            currentProcessModeRef.current = 'download_selected';
            setCurrentProcessMode('download_selected');
            setIsDownloadStarting(true);
            setDownloadModalOpen(false);
            setIsBackendProcessing(true);
            setIsExpandMiniTimer(true);
            setEngineStatus("Started");
            setSuccessBanner(`Starting download automation for ${selectedRows.length} selected booking(s)...`);

            const bookingsPayload = selectedRows.map(r => ({
                booking_number: String(r.booking_key || r.booking_key_for_export || r.customer_booking_number || r.booking_number || '').trim(),
                comp_cd: String(r.comp_cd || r.compCd || '').trim() || (companyCode ? companyCode.split('-')[0].trim() : '589'),
                vendor_cd: String(r.vendor_cd || r.vendorCd || '').trim(),
                status: String(r.status || '').trim(),
                po: String(r.booking_key || r.booking_key_for_export || '').trim(),
            }));

            const res = await window?.engine?.startProcess({
                mode: 'download_selected',
                userName,
                password,
                bookings: bookingsPayload,
                settings: {
                    companyCode,
                    downloadPoItems,
                    downloadPdf,
                    downloadDir
                }
            });

            if (res?.success === false) {
                setIsBackendProcessing(false);
                setIsExpandMiniTimer(false);
                setEngineStatus("Start Failed");
                setApiError({
                    title: 'Download Launch Failed',
                    message: res?.message || 'UIC Engine could not launch the download process.'
                });
            }
        } catch (err) {
            setIsBackendProcessing(false);
            setIsExpandMiniTimer(false);
            setEngineStatus("Start Failed");
            setApiError({
                title: 'Download Launch Error',
                message: err?.message || String(err)
            });
        } finally {
            setIsDownloadStarting(false);
        }
    };

    // Stop backend Edge process
    const handleStopBackendProcess = async () => {
        try {
            await window?.engine?.stopProcess?.();
            setIsBackendProcessing(false);
            setIsExpandMiniTimer(false);
            setEngineStatus("Stopped");
            setSuccessBanner('Backend process stop signal sent.');
            setTimeout(() => setSuccessBanner(null), 3000);
        } catch (err) {
            console.error('Stop error:', err);
        }
    };

    // Clear all cached data
    const handleClearAllData = () => {
        setStatusSummary([]);
        setGridData([]);
        setSelectedRowKeys(new Set());
        setPage(0);
        localStorage.removeItem('centuryvms_saved_status_summary');
        localStorage.removeItem('centuryvms_saved_grid_data');
        setSuccessBanner('Cleared all loaded table data.');
        setTimeout(() => setSuccessBanner(null), 2500);
    };

    // Import from JSON modal callbacks
    const handleImportStatusSummary = (raw) => {
        const parsed = parseVmsResponse(raw);
        const rawItems = parsed?.items || (Array.isArray(raw) ? raw : []);
        const summaryCategories = rawItems.filter(it => it && !it.booking_key && !it.booking_key_for_export && !it.comp_cd && !it.vendor_cd && !it.customer_booking_number);
        if (summaryCategories.length > 0) {
            setStatusSummary(summaryCategories);
            setSuccessBanner(`Imported ${summaryCategories.length} status summary categories.`);
            setTimeout(() => setSuccessBanner(null), 3000);
        } else {
            setApiError({
                title: 'Invalid Summary Payload',
                message: 'The pasted JSON contains individual booking records rather than status overview categories. Please use "Import Grid Bookings" instead.'
            });
        }
    };

    const handleImportGridData = (raw) => {
        const parsed = parseVmsResponse(raw);
        const items = parsed?.items || (Array.isArray(raw) ? raw : []);
        if (items && items.length > 0) {
            const normalized = items.map((r, idx) => ({
                ...r,
                booking_key: getRowKey(r, idx),
                status: r.status || (r.Booking_Status ? r.Booking_Status.replace(/booking/i, '').trim() : '') || 'Draft'
            }));
            setGridData(normalized);
            setSelectedRowKeys(new Set());
            setPage(0);
            setSuccessBanner(`Imported ${normalized.length} booking records.`);
            setTimeout(() => setSuccessBanner(null), 3000);
        }
    };

    // Unique company codes for filtering
    const availableCompanyCodes = useMemo(() => {
        const set = new Set();
        gridData?.forEach(row => {
            const code = row.comp_cd || row.compCd || row.company_code;
            if (code) set.add(String(code).trim());
        });
        return Array.from(set).sort();
    }, [gridData]);

    // Unique vendor codes for filtering
    const availableVendorCodes = useMemo(() => {
        const set = new Set();
        gridData?.forEach(row => {
            const code = row.vendor_cd || row.vendorCd || row.vendor_code;
            if (code) set.add(String(code).trim());
        });
        return Array.from(set).sort();
    }, [gridData]);

    // Filtered grid data
    const filteredRows = useMemo(() => {
        if (!gridData || !Array.isArray(gridData)) return [];

        return gridData.filter(row => {
            // Status filter (when not ALL)
            if (selectedStatus !== 'ALL') {
                const normSelected = normalizeStatus(selectedStatus);
                const normRowStatus = normalizeStatus(row.status || row.Booking_Status || '');
                if (normRowStatus !== normSelected) {
                    return false;
                }
            }

            // Company filter
            const rowComp = String(row.comp_cd || row.compCd || row.company_code || '').trim();
            if (selectedCompCd !== 'ALL' && rowComp !== selectedCompCd) {
                return false;
            }

            // Vendor filter
            const rowVendor = String(row.vendor_cd || row.vendorCd || row.vendor_code || '').trim();
            if (selectedVendorCd !== 'ALL' && rowVendor !== selectedVendorCd) {
                return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const bookingKey = String(row.booking_key || row.booking_key_for_export || row.customer_booking_number || row.customBookingId || '').toLowerCase();
                const vendorCd = String(row.vendor_cd || row.vendorCd || '').toLowerCase();
                const modifyBy = String(row.modify_by || row.modified_by || row.ModifyBy || '').toLowerCase();
                const createdBy = String(row.CreatedBy || row.createdBy || row.created_by || '').toLowerCase();
                const compCd = String(row.comp_cd || row.compCd || row.company_code || '').toLowerCase();
                const custBkNo = String(row.customer_booking_number || '').toLowerCase();

                return (
                    bookingKey.includes(q) ||
                    vendorCd.includes(q) ||
                    modifyBy.includes(q) ||
                    createdBy.includes(q) ||
                    compCd.includes(q) ||
                    custBkNo.includes(q)
                );
            }

            return true;
        });
    }, [gridData, selectedStatus, selectedCompCd, selectedVendorCd, searchQuery]);

    // Paginated rows
    const paginatedRows = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredRows.slice(start, start + rowsPerPage);
    }, [filteredRows, page, rowsPerPage]);

    // Selected row objects
    const selectedRowObjects = useMemo(() => {
        if (!selectedRowKeys || selectedRowKeys.size === 0) return [];
        return (gridData || []).filter((r, i) => selectedRowKeys.has(getRowKey(r, i)));
    }, [gridData, selectedRowKeys]);

    // Canonical summary categories: ensures ONLY true status categories are displayed as cards (never individual booking records)
    const uniqueStatusCategories = useMemo(() => {
        const categoryMap = new Map();

        // 1. If statusSummary has genuine summary items
        if (Array.isArray(statusSummary)) {
            statusSummary.forEach(item => {
                if (!item || typeof item !== 'object') return;
                if (item.booking_key || item.booking_key_for_export || item.comp_cd || item.vendor_cd || item.customer_booking_number) {
                    return;
                }
                const statusName = item.status || item.Booking_Status;
                if (!statusName) return;
                const norm = normalizeStatus(statusName);
                if (norm && !categoryMap.has(norm)) {
                    categoryMap.set(norm, {
                        status: item.status || statusName,
                        Booking_Status: item.Booking_Status || `${statusName} Booking`,
                        status_count: Number(item.status_count) || 0
                    });
                }
            });
        }

        // 2. If no summary from API yet, but gridData has bookings, derive summary counts per status from gridData
        if (categoryMap.size === 0 && Array.isArray(gridData) && gridData.length > 0) {
            const countByStatus = new Map();
            gridData.forEach(row => {
                const s = row.status || (row.Booking_Status ? row.Booking_Status.replace(/booking/i, '').trim() : '') || 'Draft';
                const norm = normalizeStatus(s);
                if (norm) {
                    countByStatus.set(norm, (countByStatus.get(norm) || 0) + 1);
                }
            });

            const canonicalLabels = {
                'draft': { status: 'Draft', Booking_Status: 'Draft Booking' },
                'sent': { status: 'Sent', Booking_Status: 'Sent Booking' },
                'confirmed': { status: 'Confirmed', Booking_Status: 'Confirmed Booking' },
                'declined': { status: 'Declined', Booking_Status: 'Declined Booking' },
                'void': { status: 'Void', Booking_Status: 'Void Booking' }
            };

            countByStatus.forEach((count, norm) => {
                const info = canonicalLabels[norm] || {
                    status: norm.charAt(0).toUpperCase() + norm.slice(1),
                    Booking_Status: `${norm.charAt(0).toUpperCase() + norm.slice(1)} Booking`
                };
                categoryMap.set(norm, {
                    ...info,
                    status_count: count
                });
            });
        }

        // 3. Fallback standard Century VMS categories with count matching loaded gridData
        if (categoryMap.size === 0) {
            const defaults = [
                { status: 'Draft', Booking_Status: 'Draft Booking' },
                { status: 'Sent', Booking_Status: 'Sent Booking' },
                { status: 'Confirmed', Booking_Status: 'Confirmed Booking' },
                { status: 'Declined', Booking_Status: 'Declined Booking' },
                { status: 'Void', Booking_Status: 'Void Booking' }
            ];
            defaults.forEach(d => {
                const norm = normalizeStatus(d.status);
                const countInGrid = Array.isArray(gridData) ? gridData.filter(r => normalizeStatus(r.status) === norm).length : 0;
                categoryMap.set(norm, { ...d, status_count: countInGrid });
            });
        }

        return Array.from(categoryMap.values());
    }, [statusSummary, gridData]);

    // Total counts calculation across unique categories
    const totalCountAllStatuses = useMemo(() => {
        return uniqueStatusCategories.reduce((acc, curr) => acc + (Number(curr.status_count) || 0), 0);
    }, [uniqueStatusCategories]);

    // Row selection handling
    const handleToggleRow = (key) => {
        const next = new Set(selectedRowKeys);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelectedRowKeys(next);
    };

    const handleSelectAllVisible = (e) => {
        const next = new Set(selectedRowKeys);
        if (e.target.checked) {
            paginatedRows.forEach((row, i) => {
                const k = getRowKey(row, page * rowsPerPage + i);
                if (k) next.add(k);
            });
        } else {
            paginatedRows.forEach((row, i) => {
                const k = getRowKey(row, page * rowsPerPage + i);
                if (k) next.delete(k);
            });
        }
        setSelectedRowKeys(next);
    };

    const isAllVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((row, i) => selectedRowKeys.has(getRowKey(row, page * rowsPerPage + i)));

    // Copy selected booking keys
    const handleCopySelectedKeys = () => {
        const keys = Array.from(selectedRowKeys);
        if (keys.length === 0) return;
        navigator.clipboard.writeText(keys.join('\n'));
        setCopyNotification(`Copied ${keys.length} booking keys to clipboard!`);
        setTimeout(() => setCopyNotification(null), 2500);
    };

    // Export to Excel
    const handleExportExcel = async (onlySelected = false) => {
        const targetData = onlySelected
            ? filteredRows.filter((r, i) => selectedRowKeys.has(getRowKey(r, i)))
            : filteredRows;

        if (targetData.length === 0) return;

        const headers = [
            'Row No',
            'Company Code',
            'Booking Key',
            'Booking Status',
            'Vendor Code',
            'Sub Vendor Code',
            'Est Received Date',
            'Last Modified Date',
            'Modified By',
            'Created By',
            'Customer Booking No',
            'Planned Vessel',
            'Planned Voyage',
            'Confirm Date',
            'Pre Issue FCR',
            'Custom Booking ID'
        ];

        const formatted = targetData.map((r, i) => ({
            'Row No': r.rownum || (i + 1),
            'Company Code': r.comp_cd || r.compCd || r.company_code || '',
            'Booking Key': getRowKey(r, i),
            'Booking Status': r.status || r.Booking_Status || '',
            'Vendor Code': r.vendor_cd || r.vendorCd || r.vendor_code || '',
            'Sub Vendor Code': r.sub_vendor_cd || r.subVendorCd || r.sub_vendor_code || '',
            'Est Received Date': formatVmsDate(r.est_rcvd_date || r.estRcvdDate),
            'Last Modified Date': formatVmsDate(r.last_modified || r.lastModified),
            'Modified By': r.modify_by || r.modifyBy || r.modified_by || '',
            'Created By': r.CreatedBy || r.createdBy || r.created_by || '',
            'Customer Booking No': r.customer_booking_number || '',
            'Planned Vessel': r.planned_vsl || '',
            'Planned Voyage': r.planned_voyage || '',
            'Confirm Date': formatVmsDate(r.confirm_date),
            'Pre Issue FCR': r.pre_issue_fcr || '',
            'Custom Booking ID': r.customBookingId || ''
        }));

        await exportToExcel(
            formatted,
            headers,
            `VMS_Bookings_${selectedStatus || 'Export'}`,
            setIsExporting,
            true
        );
    };

    return (
        <div className="flex flex-col gap-3 p-1 max-w-[1600px] mx-auto text-gray-800">
            {/* Top Toolbar matching Amazon Booking Correction tab */}
            <div className="flex justify-between w-full">
                <div className="flex items-center gap-2 mt-1">
                    <StickyInstructions
                        title={"Century VMS Booking Status"}
                        note={"Pull real-time booking status summaries & individual status grids directly from Century VMS. You can sequentially stream all statuses via the backend Edge process, or pull directly using your bearer token."}
                    />
                    <Tooltip title={"Timer Details"} arrow placement="right" disableInteractive>
                        <Paper
                            sx={{
                                height: 40,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                px: 1
                            }}
                        >
                            {isExpandTimer ? (
                                <ClearIcon
                                    sx={{
                                        color: "red",
                                        cursor: "pointer",
                                        fontSize: 20
                                    }}
                                    onClick={() => setIsExpandTimer(false)}
                                />
                            ) : (
                                <div className="flex items-center justify-between gap-1" onClick={() => setIsExpandTimer(true)}>
                                    <TimerOutlinedIcon
                                        sx={{
                                            color: "#707070",
                                            cursor: "pointer"
                                        }}
                                    />
                                    {isExpandMiniTimer && (
                                        <div className="flex flex-col items-center cursor-pointer">
                                            <p className="font-bold tracking-wide font-roboto text-sm text-[#1976d2]">
                                                <span className="flex">
                                                    {String(Math.floor(seconds / 3600)).padStart(2, "0")} :{" "}
                                                    {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")} :{" "}
                                                    {String(seconds % 60).padStart(2, "0")}
                                                </span>
                                            </p>
                                            <p className="font-bold tracking-wide font-roboto text-sm">Pulled: {succeed}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Paper>
                    </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip title={"Message Table"} arrow placement="left" disableInteractive>
                        <Paper
                            sx={{
                                width: 40,
                                height: 40,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {isExpandMessage ? (
                                <ClearIcon
                                    sx={{
                                        color: "gray",
                                        cursor: "pointer",
                                        fontSize: 20
                                    }}
                                    onClick={() => setIsExpandMessage(false)}
                                />
                            ) : (
                                <EmailOutlinedIcon
                                    sx={{
                                        color: "gray",
                                        cursor: "pointer"
                                    }}
                                    onClick={() => setIsExpandMessage(true)}
                                />
                            )}
                        </Paper>
                    </Tooltip>
                    <FormatDownload />
                    <SettingsMenu onSettingsChange={() => {}} />
                </div>
            </div>

            {/* Expandable Timer Section & Message Table */}
            <div
                className={`flex ${(isExpandTimer && isExpandMessage) ? "gap-2" : "gap-0"} w-full overflow-hidden pt-1`}
                style={{
                    height: (isExpandTimer || isExpandMessage) ? 190 : 0,
                    transition: "height 1s",
                }}
            >
                <TimerSection
                    isDataToRun={true}
                    dataToRunText={'Total'}
                    isSuccess={true}
                    successText={"Completed"}
                    isFaild={true}
                    engineStatus={engineStatus}
                    isExpand={isExpandTimer}
                    setIsExpand={setIsExpandTimer}
                    setSucceed={setSucceed}
                    seconds={seconds}
                    setSeconds={setSeconds}
                    chnl={chanel}
                    open={backendModalOpen}
                    handleClose={() => setBackendModalOpen(false)}
                />
                <MessageTable
                    isExpandMessage={isExpandMessage}
                    setIsExpandMessage={setIsExpandMessage}
                    chnl={chanel}
                    isExpandStatus={isExpandStatus}
                    setIsExpandStatus={setIsExpandStatus}
                />
            </div>

            {/* Header and Control Bar */}
            <Paper elevation={1} className="p-3.5 bg-white border border-gray-200 rounded-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                            <CloudDownloadIcon sx={{ fontSize: 28 }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                                    Century VMS &bull; Online Booking Status Puller
                                </h1>
                                <Chip
                                    label="Config: VobVendorOnlineBookingStatusRtn"
                                    size="small"
                                    color="default"
                                    variant="outlined"
                                    className="font-mono text-[11px]"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Pull real-time booking status summaries & individual status grids directly from Century VMS.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Backend process button */}
                        {isBackendProcessing ? (
                            <Button
                                variant="contained"
                                size="small"
                                color="error"
                                onClick={handleStopBackendProcess}
                                startIcon={<StopIcon />}
                                className="text-xs font-semibold animate-pulse"
                            >
                                Stop Edge Automation
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                size="small"
                                onClick={() => setBackendModalOpen(true)}
                                startIcon={<SmartToyIcon />}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm"
                            >
                                Pull via Backend
                            </Button>
                        )}

                        {/* <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowSettings(!showSettings)}
                            startIcon={<TuneIcon />}
                            color={token ? 'primary' : 'inherit'}
                            className="text-xs"
                        >
                            {token ? 'Token Configured' : 'API & Token'}
                        </Button>

                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setPasteModalOpen(true)}
                            startIcon={<ContentPasteIcon />}
                            color="inherit"
                            className="text-xs"
                        >
                            Paste JSON
                        </Button> */}

                        {/* <Button
                            variant="outlined"
                            size="small"
                            onClick={handlePullStatusSummary}
                            disabled={isLoadingSummary}
                            startIcon={isLoadingSummary ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                            className="text-teal-700 border-teal-300 hover:bg-teal-50 text-xs"
                        >
                            {isLoadingSummary ? 'Pulling Statuses...' : 'Pull Status Counts'}
                        </Button> */}

                        {(statusSummary.length > 0 || gridData.length > 0) && (
                            <Button
                                variant="outlined"
                                size="small"
                                color="inherit"
                                onClick={handleClearAllData}
                                startIcon={<DeleteSweepIcon sx={{ fontSize: 16 }} />}
                                className="text-xs text-gray-500 hover:text-red-600"
                            >
                                Clear
                            </Button>
                        )}

                        <Tooltip title="Open Page Layout directly in Century VMS portal">
                            <IconButton
                                size="small"
                                component="a"
                                href={DEFAULT_URLS.PAGE_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-blue-600"
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>

                {/* Collapsible API Settings Drawer */}
                <Collapse in={showSettings}>
                    <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 -mx-3.5 -mb-3.5 p-4 rounded-b-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wide">
                                <KeyIcon fontSize="small" className="text-teal-600" /> Century VMS API Credentials & Configuration
                            </span>
                            <span className="text-[11px] text-gray-400">
                                Stored locally in your browser
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <TextField
                                    label="Bearer Authorization Token"
                                    placeholder="Paste token or 'Bearer eyJ...'"
                                    size="small"
                                    fullWidth
                                    type="password"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    helperText="Extracted automatically by backend process or copy from browser Network tab"
                                    InputProps={{ style: { fontSize: '12px' } }}
                                    InputLabelProps={{ style: { fontSize: '12px' } }}
                                />
                            </div>

                            <div className="md:col-span-1">
                                <TextField
                                    label="Status Summary API URL"
                                    size="small"
                                    fullWidth
                                    value={summaryUrl}
                                    onChange={(e) => setSummaryUrl(e.target.value)}
                                    InputProps={{ style: { fontSize: '12px' } }}
                                    InputLabelProps={{ style: { fontSize: '12px' } }}
                                />
                            </div>

                            <div className="md:col-span-1">
                                <TextField
                                    label="Grid API URL Template ({STATUS})"
                                    size="small"
                                    fullWidth
                                    value={gridUrlTemplate}
                                    onChange={(e) => setGridUrlTemplate(e.target.value)}
                                    InputProps={{ style: { fontSize: '12px' } }}
                                    InputLabelProps={{ style: { fontSize: '12px' } }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    setSummaryUrl(DEFAULT_URLS.SUMMARY_API_URL);
                                    setGridUrlTemplate(DEFAULT_URLS.GRID_API_URL_TEMPLATE);
                                }}
                            >
                                Reset Defaults
                            </Button>
                            <Button size="small" variant="contained" onClick={handleSaveSettings}>
                                Save Settings
                            </Button>
                        </div>
                    </div>
                </Collapse>
            </Paper>

            {/* Success Banner */}
            {successBanner && (
                <Alert severity="success" className="text-xs py-1" onClose={() => setSuccessBanner(null)}>
                    {successBanner}
                </Alert>
            )}

            {/* Error Banner with troubleshooting actions */}
            {apiError && (
                <Alert
                    severity="warning"
                    className="text-xs"
                    onClose={() => setApiError(null)}
                    action={
                        <div className="flex gap-1.5 items-center">
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setPasteModalOpen(true)}
                                className="text-[11px]"
                            >
                                Paste JSON
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setBackendModalOpen(true)}
                                className="text-[11px]"
                            >
                                Run Backend
                            </Button>
                        </div>
                    }
                >
                    <div className="font-semibold">{apiError.title}</div>
                    <div className="mt-0.5">{apiError.message}</div>
                    {apiError.isCorsOrNetwork && (
                        <div className="text-[11px] text-gray-600 mt-1">
                            <strong>Tip:</strong> Direct browser requests may face CORS restrictions. Use the <strong>Pull via Backend</strong> button to let the backend process automate Edge and extract data directly.
                        </div>
                    )}
                </Alert>
            )}

            {/* Step 1: Status Category Cards */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircleOutlineIcon sx={{ fontSize: 16 }} className="text-teal-600" />
                        Step 1 &bull; Booking Status Overview
                        <span className="text-gray-400 font-normal">
                            ({uniqueStatusCategories.length} status categories, {totalCountAllStatuses.toLocaleString()} total bookings)
                        </span>
                    </span>

                    <span className="text-[11px] text-gray-500">
                        {uniqueStatusCategories.length === 0
                            ? 'No statuses loaded yet. Click "Pull via Backend" or "Pull Status Counts" to start.'
                            : 'Click on a status card below to filter & view bookings for that status'}
                    </span>
                </div>

                {uniqueStatusCategories.length === 0 ? (
                    <div className="p-6 bg-white border border-dashed border-gray-300 rounded-xl text-center">
                        <div className="text-xs font-semibold text-gray-600 mb-1">Status Overview Empty</div>
                        <p className="text-[11px] text-gray-400 max-w-md mx-auto mb-3">
                            Run the backend process with your Century VMS credentials to automatically pull live booking status categories and records.
                        </p>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => setBackendModalOpen(true)}
                            startIcon={<SmartToyIcon />}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                        >
                            Pull Status Counts via Backend
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                        {/* All Bookings Combined Card */}
                        <div
                            key="ALL"
                            onClick={() => { setSelectedStatus('ALL'); setPage(0); }}
                            className={`cursor-pointer transition-all rounded-xl p-3 border relative overflow-hidden flex flex-col justify-between ${
                                selectedStatus === 'ALL'
                                    ? 'bg-slate-900 text-white border-transparent scale-[1.02] shadow-md'
                                    : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50/50 shadow-sm'
                            }`}
                        >
                            {selectedStatus !== 'ALL' && (
                                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700" />
                            )}

                            <div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'ALL' ? 'text-white/80' : 'text-gray-500'}`}>
                                        All Statuses
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${selectedStatus === 'ALL' ? 'bg-white' : 'bg-slate-700'}`} />
                                </div>

                                <div className={`text-2xl font-black mt-1 ${selectedStatus === 'ALL' ? 'text-white' : 'text-gray-800'}`}>
                                    {totalCountAllStatuses.toLocaleString()}
                                </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between">
                                <span className={`text-[11px] font-medium ${selectedStatus === 'ALL' ? 'text-white/90' : 'text-gray-500'}`}>
                                    All Categories
                                </span>

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedStatus === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                    {selectedStatus === 'ALL' ? 'Active' : 'Show All'}
                                </span>
                            </div>
                        </div>

                        {uniqueStatusCategories.map((item) => {
                            const statusKey = item.status || item.Booking_Status || 'Unknown';
                            const count = Number(item.status_count) || 0;
                            const isSelected = selectedStatus !== 'ALL' && normalizeStatus(selectedStatus) === normalizeStatus(statusKey);
                            const theme = getStatusColorTheme(statusKey);

                            return (
                                <div
                                    key={statusKey}
                                    onClick={() => handleSelectStatus(statusKey)}
                                    className={`cursor-pointer transition-all rounded-xl p-3 border relative overflow-hidden flex flex-col justify-between ${
                                        isSelected
                                            ? `${theme.selectedBg} border-transparent scale-[1.02]`
                                            : `bg-white ${theme.border} ${theme.hover} shadow-sm`
                                    }`}
                                >
                                    {!isSelected && (
                                        <div className={`absolute top-0 left-0 right-0 h-1 ${theme.bar}`} />
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                                {item.Booking_Status || `${statusKey} Booking`}
                                            </span>
                                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : theme.dot}`} />
                                        </div>

                                        <div className={`text-2xl font-black mt-1 ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                            {count.toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between">
                                        <span className={`text-[11px] font-medium ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                                            Status: <span className="font-semibold">{statusKey}</span>
                                        </span>

                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : theme.badge}`}>
                                            {isSelected ? 'Active' : 'Filter'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Step 2: Grid Bookings Table Section */}
            <Paper elevation={1} className="p-3 bg-white border border-gray-200 rounded-xl flex flex-col gap-3">
                {/* Table Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                            Step 2 &bull; Bookings Grid
                            <Chip
                                label={selectedStatus === 'ALL' ? 'Status: All Statuses' : `Status: ${selectedStatus}`}
                                size="small"
                                className={`text-xs font-semibold ${getStatusColorTheme(selectedStatus).badge}`}
                            />
                        </span>

                        <span className="text-xs text-gray-500">
                            Showing <strong>{filteredRows.length}</strong> of <strong>{gridData.length}</strong> records
                        </span>

                        {selectedRowKeys.size > 0 ? (
                            <div className="flex items-center gap-1.5">
                                <Chip
                                    label={`${selectedRowKeys.size} Selected`}
                                    size="small"
                                    color="primary"
                                    className="text-xs font-semibold"
                                />
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={handleClearSelection}
                                    sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, p: 0.5, color: '#ef4444' }}
                                >
                                    Clear
                                </Button>
                            </div>
                        ) : filteredRows.length > 0 ? (
                            <Button
                                size="small"
                                variant="text"
                                onClick={handleSelectAllFiltered}
                                sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, p: 0.5, color: '#4b5563' }}
                            >
                                Select All ({filteredRows.length})
                            </Button>
                        ) : null}
                    </div>

                    {/* Table Actions Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Download Selected Bookings Button */}
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={handleOpenDownloadModal}
                            disabled={isBackendProcessing}
                            startIcon={<CloudDownloadIcon sx={{ fontSize: 15 }} />}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 12,
                                bgcolor: '#059669',
                                '&:hover': { bgcolor: '#047857' },
                                boxShadow: 1
                            }}
                        >
                            {selectedRowKeys.size > 0
                                ? `Download Selected (${selectedRowKeys.size})`
                                : `Download Bookings`
                            }
                        </Button>

                        {selectedRowKeys.size > 0 && (
                            <>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={handleCopySelectedKeys}
                                    startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                                    className="text-xs"
                                >
                                    Copy Keys ({selectedRowKeys.size})
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleExportExcel(true)}
                                    startIcon={<FileDownloadIcon sx={{ fontSize: 14 }} />}
                                    className="text-xs"
                                >
                                    Export Selected
                                </Button>
                            </>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            disabled={isExporting || filteredRows.length === 0}
                            onClick={() => handleExportExcel(false)}
                            startIcon={<FileDownloadIcon sx={{ fontSize: 14 }} />}
                            className="text-xs"
                        >
                            {isExporting ? 'Exporting...' : 'Export Excel'}
                        </Button>

                        <Button
                            size="small"
                            variant="contained"
                            disabled={isLoadingGrid}
                            onClick={() => handlePullGridData()}
                            startIcon={isLoadingGrid ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon sx={{ fontSize: 14 }} />}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                            {isLoadingGrid ? `Fetching ${selectedStatus}...` : `Refresh ${selectedStatus}`}
                        </Button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    {/* Search box */}
                    <div className="w-full sm:w-72 relative">
                        <TextField
                            size="small"
                            placeholder="Search by Booking Key, Vendor..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(0);
                            }}
                            fullWidth
                            InputProps={{
                                startAdornment: <SearchIcon sx={{ fontSize: 16, color: '#9ca3af', marginRight: '6px' }} />,
                                style: { fontSize: '12px' }
                            }}
                        />
                    </div>

                    {/* Company Code dropdown */}
                    <div className="w-full sm:w-56">
                        <TextField
                            select
                            size="small"
                            label="Company Code"
                            value={selectedCompCd}
                            onChange={(e) => {
                                setSelectedCompCd(e.target.value);
                                setPage(0);
                            }}
                            fullWidth
                            SelectProps={{ native: true }}
                            InputProps={{ style: { fontSize: '12px' } }}
                            InputLabelProps={{ style: { fontSize: '12px' } }}
                        >
                            <option value="ALL">All Company Codes</option>
                            {availableCompanyCodes.map(code => (
                                <option key={code} value={code}>
                                    {code === '589' ? '589 (Amazon Thailand)' :
                                     code === '840' ? '840 (Amazon Europe)' :
                                     code === '992' ? '992 (Amazon.com USA)' :
                                     code === '993' ? '993 (Amazon Japan)' : code}
                                </option>
                            ))}
                        </TextField>
                    </div>

                    {/* Vendor Code dropdown */}
                    <div className="w-full sm:w-56">
                        <TextField
                            select
                            size="small"
                            label="Vendor Code"
                            value={selectedVendorCd}
                            onChange={(e) => {
                                setSelectedVendorCd(e.target.value);
                                setPage(0);
                            }}
                            fullWidth
                            SelectProps={{ native: true }}
                            InputProps={{ style: { fontSize: '12px' } }}
                            InputLabelProps={{ style: { fontSize: '12px' } }}
                        >
                            <option value="ALL">All Vendors ({availableVendorCodes.length})</option>
                            {availableVendorCodes.map(code => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </TextField>
                    </div>

                    {(searchQuery || selectedCompCd !== 'ALL' || selectedVendorCd !== 'ALL') && (
                        <Button
                            size="small"
                            color="inherit"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCompCd('ALL');
                                setSelectedVendorCd('ALL');
                                setPage(0);
                            }}
                            startIcon={<FilterAltOffIcon sx={{ fontSize: 14 }} />}
                            className="text-xs whitespace-nowrap"
                        >
                            Reset Filters
                        </Button>
                    )}
                </div>

                {/* Copy notification */}
                {copyNotification && (
                    <div className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded border border-emerald-200 font-medium">
                        {copyNotification}
                    </div>
                )}

                {/* Table Container */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg min-h-[300px]">
                    <table className="w-full text-left text-xs text-gray-700 divide-y divide-gray-200">
                        <thead className="bg-gray-100/80 text-[11px] uppercase font-bold text-gray-600 tracking-wider">
                            <tr>
                                <th scope="col" className="p-2.5 w-10 text-center">
                                    <Checkbox
                                        size="small"
                                        checked={isAllVisibleSelected}
                                        onChange={handleSelectAllVisible}
                                        disabled={paginatedRows.length === 0}
                                        sx={{ padding: 0 }}
                                    />
                                </th>
                                <th scope="col" className="p-2.5 w-16 text-center">Row #</th>
                                <th scope="col" className="p-2.5 w-24">Company</th>
                                <th scope="col" className="p-2.5 font-bold">Booking Key</th>
                                <th scope="col" className="p-2.5">Status</th>
                                <th scope="col" className="p-2.5">Downloads</th>
                                <th scope="col" className="p-2.5">Vendor</th>
                                <th scope="col" className="p-2.5">Sub Vendor</th>
                                <th scope="col" className="p-2.5">Est. Recv Date</th>
                                <th scope="col" className="p-2.5">Last Modified</th>
                                <th scope="col" className="p-2.5">Modified By</th>
                                <th scope="col" className="p-2.5">Created By</th>
                                <th scope="col" className="p-2.5 text-center w-20">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white">
                            {isLoadingGrid ? (
                                <tr>
                                    <td colSpan={13} className="text-center py-12 text-gray-500">
                                        <CircularProgress size={28} className="text-blue-600 mb-2" />
                                        <div>Fetching bookings for {selectedStatus} from Century VMS...</div>
                                    </td>
                                </tr>
                            ) : paginatedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="text-center py-12 text-gray-500">
                                        <div className="text-sm font-semibold text-gray-700">No bookings available</div>
                                        <div className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                                            {gridData.length === 0
                                                ? 'Click "Pull via Backend" to automate Microsoft Edge or use "Refresh ' + selectedStatus + '" once your API token is saved.'
                                                : 'No records match your search or filter parameters.'}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRows.map((row, idx) => {
                                    const bookingKey = getRowKey(row, page * rowsPerPage + idx);
                                    const isSelected = selectedRowKeys.has(bookingKey);
                                    const theme = getStatusColorTheme(row.status);
                                    const statusDisplay = row.status || (row.Booking_Status ? row.Booking_Status.replace(/booking/i, '').trim() : '') || 'Unknown';
                                    const compDisplay = row.comp_cd || row.compCd || row.company_code || '-';
                                    const vendorDisplay = row.vendor_cd || row.vendorCd || row.vendor_code || '-';
                                    const subVendorDisplay = row.sub_vendor_cd || row.subVendorCd || row.sub_vendor_code || '-';
                                    const estRcvdDisplay = formatVmsDate(row.est_rcvd_date || row.estRcvdDate || row.est_received_date);
                                    const lastModifiedDisplay = formatVmsDate(row.last_modified || row.lastModified || row.modify_date);
                                    const modifyByDisplay = row.modify_by || row.modifyBy || row.modified_by || row.ModifyBy || '-';
                                    const createdByDisplay = row.CreatedBy || row.createdBy || row.created_by || row.create_by || row.CreateBy || '-';
                                    const rowNumDisplay = row.rownum || (page * rowsPerPage + idx + 1);

                                    return (
                                        <tr
                                            key={bookingKey + '_' + idx}
                                            className={`transition-colors hover:bg-blue-50/40 ${
                                                isSelected ? 'bg-blue-50/80' : idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                                            }`}
                                        >
                                            <td className="p-2.5 text-center">
                                                <Checkbox
                                                    size="small"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleRow(bookingKey)}
                                                    sx={{ padding: 0 }}
                                                />
                                            </td>

                                            <td className="p-2.5 text-center font-mono text-[11px] text-gray-500">
                                                {rowNumDisplay}
                                            </td>

                                            <td className="p-2.5">
                                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                                                    {compDisplay}
                                                </span>
                                            </td>

                                            <td className="p-2.5 font-mono font-bold text-blue-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{bookingKey}</span>
                                                    <Tooltip title="Copy Booking Key">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(bookingKey);
                                                                setCopyNotification(`Copied: ${bookingKey}`);
                                                                setTimeout(() => setCopyNotification(null), 2000);
                                                            }}
                                                            className="text-gray-400 hover:text-blue-600 transition-colors p-0.5"
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>

                                            <td className="p-2.5">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${theme.badge}`}>
                                                    {statusDisplay}
                                                </span>
                                            </td>

                                            <td className="p-2.5">
                                                {row.download_status ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1">
                                                            {row.po_item_file === 'Downloaded' && (
                                                                <Tooltip title="PO Items Excel saved to disk">
                                                                    <Chip
                                                                        label="PO Items"
                                                                        size="small"
                                                                        color="success"
                                                                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                            {row.pdf_file === 'Downloaded' && (
                                                                <Tooltip title="Booking Confirmation PDF saved to disk">
                                                                    <Chip
                                                                        label="PDF"
                                                                        size="small"
                                                                        color="info"
                                                                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                            {row.download_success === false && (
                                                                <Tooltip title={row.download_message || 'Download Failed'}>
                                                                    <Chip
                                                                        label="Failed"
                                                                        size="small"
                                                                        color="error"
                                                                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                        {row.download_message && (
                                                            <span className="text-[10px] text-gray-500 truncate max-w-[130px] block" title={row.download_message}>
                                                                {row.download_message}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-[11px]">-</span>
                                                )}
                                            </td>

                                            <td className="p-2.5 font-medium text-gray-800">
                                                {vendorDisplay}
                                            </td>

                                            <td className="p-2.5 text-gray-500">
                                                {subVendorDisplay}
                                            </td>

                                            <td className="p-2.5 text-gray-600 whitespace-nowrap">
                                                {estRcvdDisplay}
                                            </td>

                                            <td className="p-2.5 text-gray-600 whitespace-nowrap">
                                                {lastModifiedDisplay}
                                            </td>

                                            <td className="p-2.5 text-gray-600 font-mono text-[11px]">
                                                {modifyByDisplay}
                                            </td>

                                            <td className="p-2.5 text-gray-600 font-mono text-[11px]">
                                                {createdByDisplay}
                                            </td>

                                            <td className="p-2.5 text-center">
                                                <Tooltip title="View All Booking Attributes">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setDetailBooking(row)}
                                                        className="text-gray-500 hover:text-blue-600"
                                                    >
                                                        <VisibilityIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Pagination */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                    <div className="text-xs text-gray-500">
                        {selectedRowKeys.size > 0 && (
                            <span>
                                <strong>{selectedRowKeys.size}</strong> booking{selectedRowKeys.size > 1 ? 's' : ''} selected
                            </span>
                        )}
                    </div>

                    <TablePagination
                        component="div"
                        count={filteredRows.length}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100, 250]}
                        className="border-none text-xs"
                    />
                </div>
            </Paper>

            {/* Backend Pull Process Trigger Modal */}
            <Dialog
                open={backendModalOpen}
                onClose={() => setBackendModalOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <form onSubmit={handleStartBackendProcess}>
                    <DialogTitle className="flex items-center justify-between border-b pb-3">
                        <span className="font-bold text-base text-gray-800 flex items-center gap-1.5">
                            <SmartToyIcon className="text-emerald-600" /> Pull Data via Backend Process
                        </span>
                        <IconButton onClick={() => setBackendModalOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>

                    <DialogContent className="pt-4 space-y-3">
                        <p className="text-xs text-gray-600">
                            The backend automation will launch Microsoft Edge, authenticate to Century VMS with your credentials, discover all status categories, and sequentially pull all bookings for every status one by one into this table.
                        </p>

                        <TextField
                            label="Century VMS Username"
                            size="small"
                            fullWidth
                            required
                            value={backendCreds.userName}
                            onChange={(e) => setBackendCreds(prev => ({ ...prev, userName: e.target.value }))}
                            placeholder="e.g. AMZ1599-0"
                            InputProps={{ style: { fontSize: '13px' } }}
                            InputLabelProps={{ style: { fontSize: '13px' } }}
                        />

                        <TextField
                            label="Century VMS Password"
                            type="password"
                            size="small"
                            fullWidth
                            required
                            value={backendCreds.password}
                            onChange={(e) => setBackendCreds(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter password"
                            InputProps={{ style: { fontSize: '13px' } }}
                            InputLabelProps={{ style: { fontSize: '13px' } }}
                        />

                        <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-[11px] text-teal-800 flex items-center gap-2">
                            <span>ℹ️</span>
                            <span>All available statuses (Draft, Sent, Confirmed, etc.) will be automatically queried sequentially.</span>
                        </div>
                    </DialogContent>

                    <DialogActions className="border-t p-3">
                        <Button onClick={() => setBackendModalOpen(false)} color="inherit" size="small">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                            startIcon={<SmartToyIcon />}
                        >
                            Start Process
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Modals */}
            <BookingDetailModal
                open={Boolean(detailBooking)}
                onClose={() => setDetailBooking(null)}
                booking={detailBooking}
            />

            <PasteJsonModal
                open={pasteModalOpen}
                onClose={() => setPasteModalOpen(false)}
                onImportStatusSummary={handleImportStatusSummary}
                onImportGridData={handleImportGridData}
            />

            <DownloadSelectedModal
                open={downloadModalOpen}
                onClose={() => setDownloadModalOpen(false)}
                selectedRows={selectedRowObjects}
                onStartDownload={handleStartBookingDownload}
                isProcessing={isDownloadStarting}
            />
        </div>
    );
}
