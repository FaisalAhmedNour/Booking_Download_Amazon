import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';

import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';

import exportToExcel from '../../../Functions/exportToExcel';
import LoaderPage from '../../../Components/Loader/LoaderPage';
import { TableHeadStyle3 } from '../../../lib';

export const COMPANY_CODE_STORAGE_KEY = 'centuryvms_booking_company_codes';

export const CompanyCodeInitData = {
    header: [
        { id: 1, name: 'Sl No', isShow: true },
        { id: 2, name: 'Company Code', isShow: true },
        { id: 3, name: 'SHIP TO SHORT CODE', isShow: true },
    ],
    TableData: [
        {
            "Sl No": 1,
            "Company Code": "589 - Amazon Multi Country Consolidation Thailand",
            "SHIP TO SHORT CODE": "THNC"
        },
        {
            "Sl No": 2,
            "Company Code": "840 - Amazon Europe",
            "SHIP TO SHORT CODE": ""
        },
        {
            "Sl No": 3,
            "Company Code": "992 - Amazon.com Services LLC",
            "SHIP TO SHORT CODE": ""
        },
        {
            "Sl No": 4,
            "Company Code": "993 - Amazon Japan",
            "SHIP TO SHORT CODE": ""
        }
    ]
};

const CompanyCodeDetails = ({ open, onClose, onDataChange }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSaveActive, setIsSaveActive] = useState(false);
    const [reload, setReload] = useState(false);

    // Table state
    const [allHeaders, setAllHeaders] = useState(CompanyCodeInitData.header);
    const [headers, setHeaders] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [originalData, setOriginalData] = useState(null);

    // Search
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // Inline edit state
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingRow, setEditingRow] = useState(null);

    // Column visibility menu
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    // Modal for adding new item
    const [openModal, setOpenModal] = useState(false);
    const [newItem, setNewItem] = useState({
        "Company Code": "",
        "SHIP TO SHORT CODE": ""
    });

    // Load data from localStorage or InitData
    const loadStoredData = () => {
        try {
            setIsLoading(true);
            const stored = localStorage.getItem(COMPANY_CODE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.TableData && parsed?.header) {
                    setTableData(parsed.TableData);
                    setAllHeaders(parsed.header);
                    setOriginalData(parsed);
                    return;
                }
            }
            // fallback to seed data
            setTableData(CompanyCodeInitData.TableData);
            setAllHeaders(CompanyCodeInitData.header);
            setOriginalData(CompanyCodeInitData);
            localStorage.setItem(COMPANY_CODE_STORAGE_KEY, JSON.stringify(CompanyCodeInitData));
        } catch (e) {
            console.error("Failed to load company code details:", e);
            setTableData(CompanyCodeInitData.TableData);
            setAllHeaders(CompanyCodeInitData.header);
            setOriginalData(CompanyCodeInitData);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadStoredData();
            setIsSaveActive(false);
            setEditingIndex(null);
        }
    }, [open, reload]);

    // Update active headers
    useEffect(() => {
        const active = (allHeaders || [])
            .filter(h => h.isShow)
            .sort((a, b) => a.id - b.id)
            .map(h => h.name);
        setHeaders(active);
    }, [allHeaders]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Filter table data
    const filteredData = useMemo(() => {
        if (!debouncedSearchTerm.trim()) return tableData;
        const term = debouncedSearchTerm.toLowerCase().trim();
        return tableData.filter(row =>
            Object.values(row).some(val =>
                String(val ?? '').toLowerCase().includes(term)
            )
        );
    }, [tableData, debouncedSearchTerm]);

    // Add modal handlers
    const handleOpenAddModal = () => setOpenModal(true);
    const handleCloseAddModal = () => {
        setOpenModal(false);
        setNewItem({
            "Company Code": "",
            "SHIP TO SHORT CODE": ""
        });
    };

    const handleSaveNewItem = () => {
        const rowToAdd = {
            "Sl No": tableData.length + 1,
            ...newItem
        };
        setTableData(prev => [...prev, rowToAdd]);
        setIsSaveActive(true);
        handleCloseAddModal();
    };

    // Delete row
    const handleDeleteRow = (indexToDelete) => {
        setTableData(prev => {
            const updated = prev
                .filter((_, idx) => idx !== indexToDelete)
                .map((row, idx) => ({ ...row, "Sl No": idx + 1 }));
            return updated;
        });
        setIsSaveActive(true);
    };

    // Start inline editing
    const handleStartEdit = (index, row) => {
        setEditingIndex(index);
        setEditingRow({ ...row });
    };

    // Save inline editing
    const handleSaveEdit = (index) => {
        if (!editingRow) return;
        setTableData(prev => {
            const next = [...prev];
            next[index] = { ...editingRow };
            return next;
        });
        setEditingIndex(null);
        setEditingRow(null);
        setIsSaveActive(true);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingRow(null);
    };

    // Save all to localStorage
    const handleSaveAll = () => {
        const toSave = {
            header: allHeaders,
            TableData: tableData
        };
        localStorage.setItem(COMPANY_CODE_STORAGE_KEY, JSON.stringify(toSave));
        setOriginalData(toSave);
        setIsSaveActive(false);
        if (onDataChange) {
            onDataChange(tableData);
        }
    };

    // Cancel all changes
    const handleCancelAll = () => {
        if (originalData) {
            setTableData(originalData.TableData);
            setAllHeaders(originalData.header);
        } else {
            setReload(prev => !prev);
        }
        setIsSaveActive(false);
        setEditingIndex(null);
    };

    // Reset to initial seed data
    const handleReset = () => {
        setTableData(CompanyCodeInitData.TableData);
        setAllHeaders(CompanyCodeInitData.header);
        localStorage.setItem(COMPANY_CODE_STORAGE_KEY, JSON.stringify(CompanyCodeInitData));
        setOriginalData(CompanyCodeInitData);
        setIsSaveActive(false);
        if (onDataChange) {
            onDataChange(CompanyCodeInitData.TableData);
        }
    };

    // Export to Excel
    const handleExport = () => {
        exportToExcel(tableData, headers, 'Company_Code_Details', setIsDownloading, true);
    };

    return (
        <Dialog open={Boolean(open)} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ py: 1.5, px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f5f7fa', borderBottom: '1px solid #e0e0e0' }}>
                <span className="font-semibold text-lg text-[#1976d2]">Company Code Reference Details</span>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {isSaveActive && (
                        <>
                            <Button size="small" variant="contained" color="success" sx={{ height: 26, fontSize: 12 }} onClick={handleSaveAll}>
                                Save Changes
                            </Button>
                            <Button size="small" variant="outlined" color="warning" sx={{ height: 26, fontSize: 12 }} onClick={handleCancelAll}>
                                Cancel
                            </Button>
                        </>
                    )}
                    <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} sx={{ height: 26, fontSize: 12 }} onClick={handleOpenAddModal}>
                        Add Company Code
                    </Button>
                    <IconButton size="small" onClick={onClose} color="error">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 2 }}>
                <LoaderPage open={isLoading} />

                {/* Sub-bar: Actions & Search */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button size="small" variant="outlined" startIcon={<CachedOutlinedIcon />} sx={{ height: 26, fontSize: 12 }} onClick={() => setReload(prev => !prev)}>
                            Reload
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} sx={{ height: 26, fontSize: 12 }} onClick={handleExport} disabled={isDownloading}>
                            Export
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<RestartAltIcon />} sx={{ height: 26, fontSize: 12 }} onClick={handleReset}>
                            Reset Defaults
                        </Button>
                        <Tooltip title="Toggle Columns">
                            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ border: '1px solid #c4c4c4', borderRadius: 1, p: '3px' }}>
                                <ViewColumnIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <TextField
                        size="small"
                        placeholder="Search company codes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                            endAdornment: searchTerm ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchTerm('')} edge="end" sx={{ p: 0.2 }}>
                                        <ClearIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                        sx={{
                            width: 250,
                            '& .MuiInputBase-root': { height: 28, fontSize: 12, bgcolor: '#fff' },
                            '& .MuiOutlinedInput-input': { padding: '2px 6px' }
                        }}
                    />
                </Box>

                {/* Columns Visibility Menu */}
                <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
                    <MenuList dense>
                        {allHeaders.map((header, idx) => (
                            <MenuItem key={header.id} sx={{ display: 'flex', gap: 1 }}>
                                <Checkbox
                                    size="small"
                                    checked={header.isShow}
                                    disabled={header.name === 'Sl No' || header.name === 'Company Code'}
                                    onChange={() => {
                                        setAllHeaders(prev => {
                                            const updated = [...prev];
                                            updated[idx].isShow = !updated[idx].isShow;
                                            return updated;
                                        });
                                        setIsSaveActive(true);
                                    }}
                                />
                                <span className="text-xs">{header.name}</span>
                            </MenuItem>
                        ))}
                    </MenuList>
                </Menu>

                {/* Table */}
                <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 280px)', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {headers.map((head, i) => (
                                    <TableCell key={i} sx={{ ...TableHeadStyle3, fontSize: 12, py: 0.8, px: 1.5 }}>
                                        {head}
                                    </TableCell>
                                ))}
                                <TableCell sx={{ ...TableHeadStyle3, fontSize: 12, py: 0.8, px: 1.5, textAlign: 'center', width: 90 }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={headers.length + 1} align="center" sx={{ py: 3, color: '#888', fontSize: 13 }}>
                                        No company code records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((row, idx) => {
                                    const isEditing = editingIndex === idx;
                                    return (
                                        <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f9fafb' } }}>
                                            {headers.map((head, hIdx) => {
                                                if (head === 'Sl No') {
                                                    return (
                                                        <TableCell key={hIdx} sx={{ fontSize: 12, py: 0.6, px: 1.5, fontWeight: 500, width: 70 }}>
                                                            {row['Sl No']}
                                                        </TableCell>
                                                    );
                                                }
                                                if (isEditing) {
                                                    return (
                                                        <TableCell key={hIdx} sx={{ py: 0.3, px: 0.8 }}>
                                                            <TextField
                                                                size="small"
                                                                value={editingRow?.[head] ?? ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setEditingRow(r => ({ ...r, [head]: val }));
                                                                }}
                                                                sx={{
                                                                    width: '100%',
                                                                    '& .MuiInputBase-root': { height: 26, fontSize: 12 }
                                                                }}
                                                            />
                                                        </TableCell>
                                                    );
                                                }
                                                return (
                                                    <TableCell key={hIdx} sx={{ fontSize: 12, py: 0.6, px: 1.5 }}>
                                                        <span>{String(row[head] ?? '')}</span>
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell align="center" sx={{ py: 0.6, px: 0.8 }}>
                                                {isEditing ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                                        <IconButton size="small" color="success" onClick={() => handleSaveEdit(idx)}>
                                                            <CheckIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={handleCancelEdit}>
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                                        <IconButton size="small" color="primary" onClick={() => handleStartEdit(idx, row)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteRow(idx)}>
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Add Company Code Dialog */}
                <Dialog open={openModal} onClose={handleCloseAddModal} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ py: 1.5, px: 2, bgcolor: '#f5f7fa', fontSize: 16, fontWeight: 600 }}>
                        Add New Company Code
                    </DialogTitle>
                    <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                        <TextField
                            size="small"
                            label="Company Code"
                            placeholder="e.g. 589 - Amazon..."
                            fullWidth
                            value={newItem["Company Code"]}
                            onChange={(e) => setNewItem({ ...newItem, "Company Code": e.target.value })}
                        />
                        <TextField
                            size="small"
                            label="Ship to Short Code"
                            placeholder="e.g. THNC"
                            fullWidth
                            value={newItem["SHIP TO SHORT CODE"]}
                            onChange={(e) => setNewItem({ ...newItem, "SHIP TO SHORT CODE": e.target.value })}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 2, pb: 2 }}>
                        <Button size="small" variant="outlined" color="inherit" onClick={handleCloseAddModal}>
                            Cancel
                        </Button>
                        <Button size="small" variant="contained" color="primary" onClick={handleSaveNewItem}>
                            Add Record
                        </Button>
                    </DialogActions>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
};

export default CompanyCodeDetails;
