// Faisal Ahmed (M) - Century VMS Booking Downloader

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import FormTitle from "../../Components/FormTitle";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import CloseIcon from '@mui/icons-material/Close';
import { getStoredCompanyOptions } from "./lib";
import { useMemo } from "react";

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 600,
    maxHeight: '92vh',
    overflowY: 'auto',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 2.5,
    borderRadius: 2,
    borderColor: '#1976d2',
};

const inputLength = 200;

const ProcessController = ({
    isProcessing,
    isStartVisible,
    engineError,
    handleStop,
    handleStart,
    isGettingData,
    setIsGettingData,
    open,
    handleClose,
    formData,
    setFormData
}) => {
    const currentCompanyOptions = useMemo(() => getStoredCompanyOptions(), [open]);

    const getExcelFilePath = async () => {
        setIsGettingData(true);
        const filePath = await window?.engine?.openFile({
            title: "Select Excel File",
            accept: ["openFile"],
        });
        if (filePath?.success === true) {
            setFormData(prev => ({ ...prev, excelFile: filePath?.path?.[0] }));
        }
        setIsGettingData(false);
    };

    const getFolderPath = async () => {
        setIsGettingData(true);
        const filePath = await window?.engine?.openFile({
            title: "Select Download Destination Folder",
            accept: ["openDirectory"],
        });
        if (filePath?.success === true) {
            const folder = filePath?.path?.[0];
            setFormData(prev => ({
                ...prev,
                downloadDir: folder,
                settings: {
                    ...prev?.settings,
                    downloadDir: folder
                }
            }));
        }
        setIsGettingData(false);
    };

    const handleCompanyChange = (e) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev?.settings,
                companyCode: value
            }
        }));
    };

    const handleSettingChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev?.settings,
                [field]: value
            }
        }));
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style}>
                <div className="relative z-20 px-1">
                    <span className="absolute -top-4 -right-4">
                        <IconButton size="small" color="error" onClick={handleClose}>
                            <CloseIcon />
                        </IconButton>
                    </span>

                    <div className="text-center mb-3">
                        <h2 className="text-lg font-bold text-gray-800">Century VMS Booking Downloader</h2>
                        <p className="text-xs text-gray-500">Download PO Item files and Booking Confirmation PDFs in batch</p>
                    </div>

                    <form
                        onSubmit={handleStart}
                        className="flex flex-col items-center gap-2 justify-center bg-white p-2"
                    >
                        {/* Username */}
                        <div className="flex justify-start items-center gap-1 w-full">
                            <FormTitle
                                text={"Username"}
                                isCompulsory={true}
                                length={inputLength}
                            />
                            <div className="flex-grow mx-auto relative w-[320px]">
                                <TextField
                                    placeholder="Enter username"
                                    size="small"
                                    name="userName"
                                    variant="outlined"
                                    value={formData?.userName ?? ""}
                                    type="text"
                                    sx={{
                                        width: "100%",
                                        "& .MuiInputBase-root": {
                                            height: 28,
                                            fontSize: 14,
                                        },
                                        overflow: "hidden",
                                    }}
                                    className="editableInput"
                                    onChange={(e) =>
                                        setFormData(prev => ({
                                            ...prev,
                                            userName: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex justify-start items-center gap-1 w-full">
                            <FormTitle
                                text={"Password"}
                                isCompulsory={true}
                                length={inputLength}
                            />
                            <div className="flex-grow mx-auto relative w-[320px]">
                                <TextField
                                    placeholder="Enter password"
                                    size="small"
                                    name="password"
                                    variant="outlined"
                                    value={formData?.password ?? ""}
                                    type="password"
                                    sx={{
                                        width: "100%",
                                        "& .MuiInputBase-root": {
                                            height: 28,
                                            fontSize: 14,
                                        },
                                        overflow: "hidden",
                                    }}
                                    className="editableInput"
                                    onChange={(e) =>
                                        setFormData(prev => ({
                                            ...prev,
                                            password: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        {/* Excel File */}
                        <div className="flex justify-start items-center gap-1 w-full">
                            <FormTitle
                                text={"Select Excel File"}
                                isCompulsory={true}
                                length={inputLength}
                            />
                            <div className="flex-grow mx-auto relative w-[320px]">
                                <TextField
                                    placeholder="Select Excel file containing Booking Numbers"
                                    size="small"
                                    name="excelFile"
                                    variant="outlined"
                                    value={formData?.excelFile ?? ""}
                                    type="text"
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                    sx={{
                                        width: "100%",
                                        bgcolor: "#e8f0fe",
                                        "& .MuiInputBase-root": {
                                            height: 28,
                                            fontSize: 14,
                                        },
                                        overflow: "hidden",
                                    }}
                                    className="fixedInput"
                                />
                                <Button
                                    disabled={isGettingData}
                                    sx={{
                                        position: "absolute",
                                        right: "1px",
                                        height: "92%",
                                        width: "6px",
                                        marginTop: "1px",
                                        bgcolor: "white",
                                        color: "#283e8a",
                                        ":hover": {
                                            color: "white",
                                        },
                                    }}
                                    component="label"
                                    variant="contained"
                                    onClick={getExcelFilePath}
                                >
                                    <UploadFileOutlinedIcon />
                                </Button>
                            </div>
                        </div>

                        {/* Download Destination Directory */}
                        <div className="flex justify-start items-center gap-1 w-full">
                            <FormTitle
                                text={"Save Destination"}
                                isCompulsory={false}
                                length={inputLength}
                            />
                            <div className="flex-grow mx-auto relative w-[320px]">
                                <TextField
                                    placeholder="Default: Same folder as Excel file"
                                    size="small"
                                    name="downloadDir"
                                    variant="outlined"
                                    value={formData?.downloadDir || formData?.settings?.downloadDir || ""}
                                    type="text"
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                    sx={{
                                        width: "100%",
                                        bgcolor: "#f5f5f5",
                                        "& .MuiInputBase-root": {
                                            height: 28,
                                            fontSize: 13,
                                        },
                                        overflow: "hidden",
                                    }}
                                    className="fixedInput"
                                />
                                <Button
                                    disabled={isGettingData}
                                    sx={{
                                        position: "absolute",
                                        right: "1px",
                                        height: "92%",
                                        width: "6px",
                                        marginTop: "1px",
                                        bgcolor: "white",
                                        color: "#283e8a",
                                        ":hover": {
                                            color: "white",
                                        },
                                    }}
                                    component="label"
                                    variant="contained"
                                    onClick={getFolderPath}
                                >
                                    <FolderOpenOutlinedIcon />
                                </Button>
                            </div>
                        </div>

                        {/* Company Code */}
                        <div className="flex justify-start items-center gap-1 w-full">
                            <FormTitle
                                text={"Company Code"}
                                isCompulsory={true}
                                length={inputLength}
                            />
                            <div className="flex-grow mx-auto relative w-[320px]">
                                <FormControl size="small" sx={{ width: "100%" }}>
                                    <Select
                                        value={formData?.settings?.companyCode ?? ""}
                                        onChange={handleCompanyChange}
                                        displayEmpty
                                        sx={{
                                            height: 28,
                                            fontSize: 13,
                                            "& .MuiSelect-select": {
                                                py: 0,
                                                fontSize: 13,
                                                display: "flex",
                                                alignItems: "center"
                                            }
                                        }}
                                    >
                                        {currentCompanyOptions.map((item, idx) => (
                                            <MenuItem key={idx} value={item.companyCode} sx={{ fontSize: 13 }}>
                                                {item.companyCode}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>
                        </div>

                        {/* Download Options (Both or One) */}
                        <div className="w-full border-t border-gray-200 pt-3 mt-1">
                            <div className="text-xs font-semibold text-gray-700 mb-1 pl-1">
                                Files to Download:
                            </div>
                            <div className="flex flex-col gap-1 pl-3 bg-gray-50 p-2 rounded border border-gray-100">
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={formData?.settings?.downloadPoItems ?? true}
                                            onChange={(e) => handleSettingChange("downloadPoItems", e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <span className="text-sm font-medium text-gray-800">
                                            Download PO Item Files (Excel/CSV) from POItem tab
                                        </span>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={formData?.settings?.downloadPdf ?? true}
                                            onChange={(e) => handleSettingChange("downloadPdf", e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <span className="text-sm font-medium text-gray-800">
                                            Download Booking Confirmation PDF (Report)
                                        </span>
                                    }
                                />
                            </div>
                        </div>

                        {typeof engineError === 'string' && (
                            <p className="text-[red] text-xs text-center mt-1 w-full">{engineError}</p>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                sx={{ height: 32, px: 4, fontWeight: 'bold' }}
                                color="success"
                            >
                                Start Download
                            </Button>
                        </div>
                    </form>
                </div>
            </Box>
        </Modal>
    );
};

export default ProcessController;