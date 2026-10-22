import PropTypes from 'prop-types';
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import { parseVmsResponse } from './vmsApi';

export default function PasteJsonModal({ open, onClose, onImportStatusSummary, onImportGridData }) {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const handleParseAndApply = () => {
        setError(null);
        setSuccessMsg(null);

        if (!jsonText.trim()) {
            setError('Please paste JSON text first.');
            return;
        }

        try {
            const parsed = parseVmsResponse(jsonText);
            if (!parsed) {
                setError('Could not parse response structure.');
                return;
            }

            if (parsed.isGridBookings) {
                onImportGridData(parsed.raw || parsed.items);
                setSuccessMsg(`Successfully imported Grid Table with ${parsed.items.length} bookings!`);
                setTimeout(() => {
                    setSuccessMsg(null);
                    onClose();
                }, 1000);
            } else if (parsed.isStatusSummary) {
                onImportStatusSummary(parsed.raw || parsed.items);
                setSuccessMsg(`Successfully imported Status Summary with ${parsed.items.length} status categories!`);
                setTimeout(() => {
                    setSuccessMsg(null);
                    onClose();
                }, 1000);
            } else if (Array.isArray(parsed.items)) {
                onImportGridData(parsed.raw || parsed.items);
                setSuccessMsg(`Successfully imported Grid Table with ${parsed.items.length} records!`);
                setTimeout(() => {
                    setSuccessMsg(null);
                    onClose();
                }, 1000);
            } else {
                setError('Unrecognized Century VMS payload structure. Expecting WebApiResult with GridDataTable.');
            }
        } catch (e) {
            setError(`JSON Parse Error: ${e.message}`);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setJsonText(event.target?.result || '');
        };
        reader.readAsText(file);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle className="flex items-center justify-between border-b pb-3">
                <span className="font-bold text-base text-gray-800">
                    Import / Paste Century VMS JSON Response
                </span>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent className="pt-4 space-y-3">
                <p className="text-xs text-gray-600">
                    You can paste either the <strong>Status Count Summary JSON</strong> (from <code>#/pagelayout?configName=VobVendorOnlineBookingStatusRtn</code>) or the <strong>Grid Data JSON</strong> (from <code>/api/Vob/Vob/GetVendorOnlineBookingStatusRtnGrid</code>). The parser will automatically detect the structure.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-semibold px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer text-gray-700">
                        Upload .JSON File
                        <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {jsonText && (
                        <Button size="small" color="inherit" onClick={() => setJsonText('')}>
                            Clear
                        </Button>
                    )}
                </div>

                {error && (
                    <Alert severity="error" className="text-xs">
                        {error}
                    </Alert>
                )}

                {successMsg && (
                    <Alert severity="success" className="text-xs">
                        {successMsg}
                    </Alert>
                )}

                <textarea
                    rows={14}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder="Paste { &quot;Type&quot;: &quot;WebApiResult&quot;, &quot;GridDataTable&quot;: [ ... ] } here..."
                    className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50"
                />
            </DialogContent>

            <DialogActions className="border-t p-3">
                <Button onClick={onClose} color="inherit" size="small">
                    Cancel
                </Button>
                <Button onClick={handleParseAndApply} variant="contained" color="primary" size="small">
                    Parse & Apply
                </Button>
            </DialogActions>
        </Dialog>
    );
}

PasteJsonModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onImportStatusSummary: PropTypes.func.isRequired,
    onImportGridData: PropTypes.func.isRequired
};
