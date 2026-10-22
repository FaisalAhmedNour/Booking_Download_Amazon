// Faisal Ahmed - Century VMS Download Selected Bookings Modal

import { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FormTitle from '../../Components/FormTitle';
import { getStoredCompanyOptions } from '../DownloadPO/lib';

const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 620,
    maxWidth: '94vw',
    maxHeight: '92vh',
    overflowY: 'auto',
    bgcolor: 'background.paper',
    border: '2px solid #1976d2',
    boxShadow: 24,
    p: 3,
    borderRadius: 2,
};

const inputLabelLength = 190;

export default function DownloadSelectedModal({
    open,
    onClose,
    selectedRows = [],
    onStartDownload,
    isProcessing = false
}) {
    const companyOptions = useMemo(() => getStoredCompanyOptions(), [open]);

    const [userName, setUserName] = useState(() => localStorage.getItem('centuryvms_saved_username') || '');
    const [password, setPassword] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [downloadDir, setDownloadDir] = useState(() => localStorage.getItem('centuryvms_saved_download_dir') || '');
    const [downloadPoItems, setDownloadPoItems] = useState(true);
    const [downloadPdf, setDownloadPdf] = useState(true);
    const [isSelectingFolder, setIsSelectingFolder] = useState(false);
    const [formError, setFormError] = useState(null);

    // Synchronize default company code when modal opens or selected rows change
    useEffect(() => {
        if (!open) return;

        // Try to infer company code from the first selected row if available
        const rowComp = selectedRows?.[0]?.comp_cd || selectedRows?.[0]?.compCd || selectedRows?.[0]?.company_code || '';
        if (rowComp && companyOptions?.length) {
            const matched = companyOptions.find(opt =>
                String(opt.companyCode).startsWith(String(rowComp)) ||
                String(opt.value).startsWith(String(rowComp))
            );
            if (matched) {
                setCompanyCode(matched.companyCode || matched.value);
                return;
            }
        }

        // Fallback to default company option
        if (companyOptions?.length && !companyCode) {
            setCompanyCode(companyOptions[0].companyCode || companyOptions[0].value);
        }
    }, [open, selectedRows, companyOptions]);

    const handleSelectFolder = async () => {
        setIsSelectingFolder(true);
        try {
            const res = await window?.engine?.openFile?.({
                title: 'Select Destination Folder for Booking Downloads',
                accept: ['openDirectory']
            });
            if (res?.success && res?.path?.[0]) {
                const folder = res.path[0];
                setDownloadDir(folder);
                localStorage.setItem('centuryvms_saved_download_dir', folder);
            }
        } catch (err) {
            console.error('Error selecting folder:', err);
        } finally {
            setIsSelectingFolder(false);
        }
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();

        if (!userName.trim() || !password.trim()) {
            setFormError('Username and Password are required to log into Century VMS.');
            return;
        }

        if (!downloadPoItems && !downloadPdf) {
            setFormError('Please select at least one download option (PO Item Files or PDF).');
            return;
        }

        if (selectedRows.length === 0) {
            setFormError('No bookings are currently selected.');
            return;
        }

        setFormError(null);
        localStorage.setItem('centuryvms_saved_username', userName.trim());
        if (downloadDir) {
            localStorage.setItem('centuryvms_saved_download_dir', downloadDir);
        }

        onStartDownload({
            userName: userName.trim(),
            password: password.trim(),
            companyCode,
            downloadDir: downloadDir.trim(),
            downloadPoItems,
            downloadPdf,
            selectedRows
        });
    };

    // Extract first few booking numbers for preview
    const previewKeys = useMemo(() => {
        return selectedRows.slice(0, 5).map(r =>
            r.booking_key || r.booking_key_for_export || r.customer_booking_number || r.booking_number || 'N/A'
        );
    }, [selectedRows]);

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={modalStyle}>
                <div className="relative">
                    <span className="absolute -top-1 -right-1">
                        <IconButton size="small" color="error" onClick={onClose} disabled={isProcessing}>
                            <CloseIcon />
                        </IconButton>
                    </span>

                    <div className="text-center mb-3">
                        <Typography variant="h6" className="font-bold text-gray-800" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <CloudDownloadIcon color="primary" /> Download Selected Bookings
                        </Typography>
                        <Typography variant="body2" className="text-gray-500 text-xs mt-0.5">
                            Automated download of PO Item Excel sheets and Booking Confirmation PDFs
                        </Typography>
                    </div>

                    {/* Selected Bookings Summary Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-blue-900">
                                Selected for Download:
                            </span>
                            <Chip
                                label={`${selectedRows.length} Bookings`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 600, height: 22 }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                            {previewKeys.map((k, idx) => (
                                <Chip
                                    key={idx}
                                    label={k}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: 11, bgcolor: 'white' }}
                                />
                            ))}
                            {selectedRows.length > 5 && (
                                <span className="text-xs text-blue-700 font-medium ml-1">
                                    +{selectedRows.length - 5} more
                                </span>
                            )}
                        </div>
                    </div>

                    {formError && (
                        <Alert severity="error" sx={{ mb: 2, py: 0.5, fontSize: 13 }} onClose={() => setFormError(null)}>
                            {formError}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                        {/* Username */}
                        <div className="flex items-center gap-1 w-full">
                            <FormTitle text="Username" isCompulsory={true} length={inputLabelLength} />
                            <div className="flex-grow">
                                <TextField
                                    placeholder="Enter Century VMS Username"
                                    size="small"
                                    fullWidth
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    sx={{ "& .MuiInputBase-root": { height: 32, fontSize: 13 } }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex items-center gap-1 w-full">
                            <FormTitle text="Password" isCompulsory={true} length={inputLabelLength} />
                            <div className="flex-grow">
                                <TextField
                                    placeholder="Enter Century VMS Password"
                                    type="password"
                                    size="small"
                                    fullWidth
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    sx={{ "& .MuiInputBase-root": { height: 32, fontSize: 13 } }}
                                />
                            </div>
                        </div>

                        {/* Company Code */}
                        <div className="flex items-center gap-1 w-full">
                            <FormTitle text="Company Code" isCompulsory={true} length={inputLabelLength} />
                            <div className="flex-grow">
                                <FormControl size="small" fullWidth>
                                    <Select
                                        value={companyCode}
                                        onChange={(e) => setCompanyCode(e.target.value)}
                                        sx={{
                                            height: 32,
                                            fontSize: 13,
                                            "& .MuiSelect-select": { py: 0.5, fontSize: 13 }
                                        }}
                                    >
                                        {companyOptions.map((opt, idx) => (
                                            <MenuItem key={idx} value={opt.companyCode || opt.value} sx={{ fontSize: 13 }}>
                                                {opt.companyCode || opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>
                        </div>

                        {/* Save Destination Folder */}
                        <div className="flex items-center gap-1 w-full">
                            <FormTitle text="Save Destination" isCompulsory={false} length={inputLabelLength} />
                            <div className="flex-grow relative">
                                <TextField
                                    placeholder="Default: User Downloads / Current working directory"
                                    size="small"
                                    fullWidth
                                    value={downloadDir}
                                    InputProps={{ readOnly: true }}
                                    sx={{
                                        bgcolor: '#f8f9fa',
                                        "& .MuiInputBase-root": { height: 32, fontSize: 12 }
                                    }}
                                />
                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={isSelectingFolder}
                                    onClick={handleSelectFolder}
                                    sx={{
                                        position: 'absolute',
                                        right: 2,
                                        top: 2,
                                        bottom: 2,
                                        minWidth: 36,
                                        px: 1,
                                        bgcolor: '#1976d2',
                                        ':hover': { bgcolor: '#115293' }
                                    }}
                                >
                                    <FolderOpenOutlinedIcon fontSize="small" />
                                </Button>
                            </div>
                        </div>

                        {/* Download Options */}
                        <div className="border-t border-gray-200 pt-2.5 mt-1">
                            <div className="text-xs font-semibold text-gray-700 mb-1 pl-0.5">
                                Files to Download:
                            </div>
                            <div className="flex flex-col gap-1 pl-3 bg-gray-50 p-2 rounded border border-gray-100">
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={downloadPoItems}
                                            onChange={(e) => setDownloadPoItems(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <span className="text-xs font-medium text-gray-800">
                                            Download PO Item Files (Excel/CSV) from POItem tab
                                        </span>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={downloadPdf}
                                            onChange={(e) => setDownloadPdf(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <span className="text-xs font-medium text-gray-800">
                                            Download Booking Confirmation PDF
                                        </span>
                                    }
                                />
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={onClose}
                                disabled={isProcessing}
                                size="small"
                                sx={{ textTransform: 'none' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={isProcessing || selectedRows.length === 0}
                                startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
                                size="small"
                                sx={{ textTransform: 'none', px: 2.5 }}
                            >
                                {isProcessing ? 'Starting Engine...' : `Start Download (${selectedRows.length})`}
                            </Button>
                        </div>
                    </form>
                </div>
            </Box>
        </Modal>
    );
}
