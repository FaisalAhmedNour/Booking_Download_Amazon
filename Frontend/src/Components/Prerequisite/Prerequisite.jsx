import { useState } from "react";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";

const Prerequisite = ({ handleUpdateSC, disabled = false }) => {
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const downloadFile = (url) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex justify-center">
            <Tooltip title={"Prerequisite"} arrow placement="left">
                <Paper
                    sx={{
                        overflow: "hidden",
                        py: 1,
                        px: 1,
                        width: 40,
                        height: 40,
                    }}
                    className="space-y-1"
                    onClick={handleClick}
                >
                    {/* <img src="./prerequisite.png" alt="prerequisite" width={'100%'} height={'100%'} /> */}
                    <img
                        src="./prerequisite.png"
                        alt="Prerequisite icon"
                        width="100%"
                        height="100%"
                    />
                </Paper>
            </Tooltip>
            <Popover
                // id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
            >
                <Typography sx={{ p: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 12 }}>Update Info</Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',

                        }}
                    >
                        {/* disabled  */}
                        <Typography
                            component='a'
                            // href='/E-INVOICE_HM_V.0.1.4 DT 19.01.2025.xlsx'
                            onClick={disabled || handleUpdateSC}
                            sx={{
                                fontSize: 16,
                                width: '100%',
                                px: 1,
                                cursor: 'pointer',
                                color: disabled ? '#ccc' : 'inherit',
                                ":hover": {
                                    bgcolor: '#f6f6f6'
                                }
                            }}
                        >Update Shipment Schedule</Typography>
                    </Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: 12 }}>Download</Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',

                        }}
                    >
                        <Typography
                            component='a'
                            onClick={() => downloadFile('E-INVOICE_HM_V.0.1.4 DT 19.01.2025.xlsx')}
                            // href='/E-INVOICE_HM_V.0.1.4 DT 19.01.2025.xlsx'
                            sx={{
                                fontSize: 16,
                                width: '100%',
                                px: 1,
                                cursor: 'pointer',
                                ":hover": {
                                    bgcolor: '#f6f6f6'
                                }
                            }}
                        >Format For Create And Download</Typography>
                        <Typography
                            component='a'
                            // href='/DOWNLOAD E-INVOICE (HM).xlsx'
                            onClick={() => downloadFile('DOWNLOAD E-INVOICE (HM).xlsx')}
                            sx={{
                                fontSize: 16,
                                width: '100%',
                                px: 1,
                                cursor: 'pointer',
                                ":hover": {
                                    bgcolor: '#f6f6f6'
                                }
                            }}
                        >Format For Only Download</Typography>
                    </Typography>
                </Typography>
            </Popover>
        </div>
    );
};

export default Prerequisite;