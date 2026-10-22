import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useState } from 'react';
import { formatVmsDate, getStatusColorTheme } from './vmsApi';

const FIELD_GROUPS = [
    {
        title: 'Core Booking Identifiers',
        fields: [
            { key: 'booking_key', label: 'Booking Key', highlight: true },
            { key: 'booking_key_for_export', label: 'Export Booking Key' },
            { key: 'rownum', label: 'Row Number' },
            { key: 'comp_cd', label: 'Company Code' },
            { key: 'status', label: 'Booking Status', isStatus: true },
            { key: 'customer_booking_number', label: 'Customer Booking No' },
            { key: 'customBookingId', label: 'Custom Booking ID' },
            { key: 'pre_issue_fcr', label: 'Pre Issue FCR' }
        ]
    },
    {
        title: 'Vendors & Parties',
        fields: [
            { key: 'vendor_cd', label: 'Vendor Code' },
            { key: 'sub_vendor_cd', label: 'Sub Vendor Code' },
            { key: 'modify_by', label: 'Modified By' },
            { key: 'CreatedBy', label: 'Created By' },
            { key: 'division', label: 'Division' }
        ]
    },
    {
        title: 'Dates & Timeline',
        fields: [
            { key: 'est_rcvd_date', label: 'Est. Received Date', isDate: true },
            { key: 'last_modified', label: 'Last Modified Date', isDate: true },
            { key: 'confirm_date', label: 'Confirm Date', isDate: true }
        ]
    },
    {
        title: 'Vessel, Status & Logs',
        fields: [
            { key: 'planned_vsl', label: 'Planned Vessel' },
            { key: 'planned_voyage', label: 'Planned Voyage' },
            { key: 'CustomerStatus', label: 'Customer Status' },
            { key: 'BookingReviewed', label: 'Booking Reviewed' },
            { key: 'VIBEStatus', label: 'VIBE Status' },
            { key: 'documentid', label: 'Document ID' },
            { key: 'misc_value', label: 'Misc Value' },
            { key: 'messagelog', label: 'Message Log' }
        ]
    }
];

export default function BookingDetailModal({ open, onClose, booking }) {
    const [copiedKey, setCopiedKey] = useState(false);
    const [viewRawJson, setViewRawJson] = useState(false);

    if (!booking) return null;

    const theme = getStatusColorTheme(booking.status);

    const bookingKey = booking.booking_key || booking.booking_key_for_export || booking.customer_booking_number || booking.customBookingId || '';

    const handleCopyBookingKey = () => {
        if (bookingKey) {
            navigator.clipboard.writeText(bookingKey);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-gray-800">Booking Details</span>
                    <span className="font-mono text-sm px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                        {bookingKey || 'N/A'}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${theme.badge}`}>
                        {booking.status || 'Draft'}
                    </span>
                </div>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent className="pt-4 space-y-6">
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleCopyBookingKey}
                        startIcon={copiedKey ? <CheckIcon /> : <ContentCopyIcon />}
                    >
                        {copiedKey ? 'Copied Key!' : 'Copy Booking Key'}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setViewRawJson(!viewRawJson)}
                    >
                        {viewRawJson ? 'View Formatted' : 'View Raw JSON'}
                    </Button>
                </div>

                {viewRawJson ? (
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono max-h-96">
                        {JSON.stringify(booking, null, 2)}
                    </pre>
                ) : (
                    <div className="space-y-5">
                        {FIELD_GROUPS.map((group, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                                    {group.title}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {group.fields.map(field => {
                                        let val = booking[field.key];
                                        if (field.isDate) {
                                            val = formatVmsDate(val, 'DD-MMM-YYYY HH:mm');
                                        } else if (val === null || val === undefined || val === '') {
                                            val = <span className="text-gray-400 italic">null</span>;
                                        }

                                        return (
                                            <div key={field.key} className="bg-white p-2.5 rounded border border-gray-100 shadow-sm">
                                                <div className="text-[11px] text-gray-500 font-medium">
                                                    {field.label}
                                                </div>
                                                <div className={`text-xs mt-0.5 font-semibold text-gray-800 break-all ${field.highlight ? 'font-mono text-blue-600' : ''}`}>
                                                    {val}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>

            <DialogActions className="border-t p-3">
                <Button onClick={onClose} variant="contained" size="small">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}

BookingDetailModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    booking: PropTypes.object
};
