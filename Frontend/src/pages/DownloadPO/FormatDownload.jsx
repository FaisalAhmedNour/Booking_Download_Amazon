// Faisal Ahmed(C) - 11 August 2025

import Swal from "sweetalert2";
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
// import SimCardDownloadIcon from '@mui/icons-material/SimCardDownload';
import SimCardDownloadOutlinedIcon from '@mui/icons-material/SimCardDownloadOutlined';

const FormatDownload = () => {
    const handleDownload = async () => {
        const randomFourDigitNumber = Math.floor(1000 + Math.random() * 9000);

        try {
            Swal.fire({
                title: "Preparing Download...",
                html: "Fetching the file, please wait...",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const filePath = `./BOOKING_FORMAT_CENT_V.0.0.1 DT 08.06.2026.xlsx`;
            const response = await fetch(filePath);

            // ❌ Handle missing or blocked file
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `BOOKING_FORMAT_CENT_V.0.0.1 DT 08.06.2026_${randomFourDigitNumber}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(url);

            Swal.fire({
                icon: "success",
                title: "Download Ready!",
                text: "Your Excel file has been downloaded successfully.",
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Download failed:", error);

            let errorMessage = "An unknown error occurred.";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === "string") {
                errorMessage = error;
            }

            Swal.fire({
                icon: "error",
                title: "Download Failed",
                text: errorMessage
            });
        }
    };

    return (
        <div>
            {/* Icon */}
            <Tooltip title={"Download Format"} arrow placement="right" disableInteractive>
                <Paper
                    sx={{
                        overflow: "hidden",
                        py: 1,
                        px: 1,
                        width: 40,
                        height: 40,
                        // maxHeight: 40,
                        // minHeight: 40,
                        // transition: "width 1s,max-height 1s, min-height 1s",
                    }}
                    className="space-y-1"
                    onClick={handleDownload}
                >
                    <SimCardDownloadOutlinedIcon
                        sx={{
                            color: "gray",
                            // rotate: "180deg",
                            cursor: "pointer",
                        }}
                    />
                </Paper>
            </Tooltip>
        </div>
    );
};

export default FormatDownload;