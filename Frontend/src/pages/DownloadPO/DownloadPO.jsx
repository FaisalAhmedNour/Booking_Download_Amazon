// Faisal (C) 11 August 2025

import { useEffect, useState, useRef } from "react";
import moment from "moment";
import ProcessController from "./ProcessController";
import TimerSection from "../../Components/TimerSection";
import MessageTable from "../../Components/MessageTable";
import PulledDataFromEngine from "./PulledDataFromEngine";
import LoaderPage from "../../Components/Loader/LoaderPage";
import { headerKeysForPulling, headersForPulling, getStoredVendorOptions, getStoredCompanyOptions } from "./lib";
import StickyInstructions from "../../Components/StickyInstructions/StickyInstructions";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import ClearIcon from "@mui/icons-material/Clear";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import SimCardDownloadOutlinedIcon from "@mui/icons-material/SimCardDownloadOutlined";
import FormatDownload from "./FormatDownload";
import SettingsMenu from "../Settings/SettingsMenu";

const DownloadPO = () => {
    const listenerAdded = useRef(false);
    // engine
    const [engineStatus, setEngineStatus] = useState(null);
    const [isGettingData, setIsGettingData] = useState(false);
    // flag
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStartVisible, setIsStartVisible] = useState(true);
    const [isExpandStatus, setIsExpandStatus] = useState(false);
    // form data
    const [formData, setFormData] = useState(() => {
        const storedVendors = getStoredVendorOptions();
        const storedCompanies = getStoredCompanyOptions();
        const defaultVendor = storedVendors[0] || {};
        const defaultCompany = storedCompanies[0] || {};
        return {
            userName: "",
            password: "",
            excelFile: "",
            downloadDir: "",
            settings: {
                companyCode: defaultCompany.companyCode || "589 - Amazon Multi Country Consolidation Thailand",
                downloadPoItems: true,
                downloadPdf: true,
                downloadDir: ""
            }
        };
    });
    const [filePath, setFilePath] = useState(null);
    const [saveTemplate, setSaveTemplate] = useState('FCR_NO');
    const [saveMode, setSaveMode] = useState('Draft');
    // const [cookie, setCookie] = useState(undefined);
    const [wait, setWait] = useState(0);
    const [downloadPdf, setDownloadPdf] = useState(true);
    // loading
    const [isLoading, setIsLoading] = useState(false);
    // error
    const [engineError, setEngineError] = useState(null);
    // reload
    const [reloadPulledData, setReloadPulledData] = useState(false);
    const [reloadUploadedData, setReloadUploadedData] = useState(false);
    // pulled Data table from engine
    const [pageOfPulledFromEngine, setPageOfPulledFromEngine] = useState(0);
    const [rowsPerPageOfPulledFromEngine, setRowsPerPageOfPulledFromEngine] = useState(5);
    const [tableBodyDataOfPulledFromEngine, setTableBodyDataOfPulledFromEngine] = useState([]);
    const [originalTableBodyDataOfPulledFromEngine, setOriginalTableBodyDataOfPulledFromEngine] = useState([]);
    // chanel
    const [chanel, setChanel] = useState('d');

    const [isExpandTimer, setIsExpandTimer] = useState(false);
    const [isExpandMiniTimer, setIsExpandMiniTimer] = useState(false);
    const [isExpandMessage, setIsExpandMessage] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [succeed, setSucceed] = useState(0);

    // Modal
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleSettingsUpdated = () => {
        const storedVendors = getStoredVendorOptions();
        const storedCompanies = getStoredCompanyOptions();
        setFormData(prev => {
            const currentVendor = storedVendors.find(v => v.value === prev?.settings?.shipVendorCode || v.vendorFullName === prev?.settings?.shipVendorCode || v.shipVendorCode === prev?.settings?.shipVendorCode) || storedVendors[0];
            const currentCompany = storedCompanies.find(c => c.companyCode === prev?.settings?.companyCode) || storedCompanies[0];
            return {
                ...prev,
                settings: {
                    ...prev?.settings,
                    companyCode: currentCompany?.companyCode || prev?.settings?.companyCode,
                    shipVendorCode: currentVendor?.value || prev?.settings?.shipVendorCode,
                    addEditManufacturer: currentVendor?.addEditManufacturer ?? prev?.settings?.addEditManufacturer,
                    shipperName: currentVendor?.shipperName ?? prev?.settings?.shipperName,
                    contactPhone: currentVendor?.contactPhone ?? prev?.settings?.contactPhone,
                    contactEmail: currentVendor?.contactEmail ?? prev?.settings?.contactEmail,
                    emailAddressToReceiveFCR: currentVendor?.emailAddressToReceiveFCR ?? prev?.settings?.emailAddressToReceiveFCR,
                }
            };
        });
    };

    const getEngineOnSignal = () => {
        window?.engine?.onProcessStart(function (message) {
            setIsProcessing(true);
            setIsExpandMiniTimer(true);
        });
    };

    const getEngineOffSignal = () => {
        window?.engine?.onProcessStop(function (message) {
            setIsExpandMiniTimer(false);
            setIsProcessing(false);
        });
    };

    useEffect(() => {
        if (listenerAdded.current) return; // skip if already added

        getEngineOnSignal();
        getEngineOffSignal();

        const handleTableData = (dt) => {
            console.log('row', dt);
            if (!dt) return;

            const items = Array.isArray(dt.data) && dt.data.length > 0 ? dt.data : [{}];
            const newRows = [];

            items.forEach((item) => {
                const tableRow = {};
                headerKeysForPulling?.forEach((key) => {
                    const headerLabel = headersForPulling[key];
                    if (key === "Success") {
                        tableRow[headerLabel] = dt.Success ? 'Yes' : 'No';
                        tableRow['isError'] = !dt.Success;
                    } else if (key === "Message") {
                        tableRow[headerLabel] = dt.Message || "";
                    } else if (key === "booking_number") {
                        tableRow[headerLabel] = dt.booking_number || item?.booking_number || "";
                    } else if (key === "booking_created") {
                        tableRow[headerLabel] = dt.booking_created || item?.booking_created || "";
                    } else if (key === "po_status") {
                        tableRow[headerLabel] = dt.po_status || item?.po_status || item?.["PO status"] || item?.[key] || "";
                    } else if (key === "window_end" || key === "ecdd") {
                        const rawDate = dt[key] || item?.[key] || item?.[headerLabel] || "";
                        tableRow[headerLabel] = (rawDate && moment(rawDate).isValid())
                            ? moment(rawDate).format("DD-MMM-YYYY")
                            : (rawDate || "");
                    } else {
                        tableRow[headerLabel] = item ? (item[key] ?? item[headerLabel] ?? "") : "";
                    }
                });
                newRows.push(tableRow);
            });

            setTableBodyDataOfPulledFromEngine((prev) => [...prev, ...newRows]);
            setOriginalTableBodyDataOfPulledFromEngine((prev) => [...prev, dt]);
        };

        window?.engine?.onTableData(handleTableData);
        listenerAdded.current = true;

        return () => {
            window?.engine?.offTableData?.(handleTableData);
            listenerAdded.current = false;
        };
    }, []);

    // trigger engine start
    const startEngine = async (data) => {
        try {
            // const test_data = {
            //     "excelFile": "C:/Users/faisa/Downloads/UCS Oct Delivery PO on 9.11___master chart.xlsx",
            //     // "excelFile": "C:/Users/faisa/Downloads/BOOKING_FORMAT_CENT_V.0.0.1 DT 08.06.2026.xlsx",
            //     "userName": "AMZ1599-0",
            //     "password": "Epic@123456",
            //     "settings": {
            //         "companyCode": "589 - Amazon Multi Country Consolidation Thailand",
            //         "shipVendorCode": " EPLYL - Epic Garments DWC LLC|EPIC Garments Manufacturing Co. Ltd (S004877)|ST-636242|PBGO-Laem Chabang|WW|Private Brands",
            //         "contactPhone": "01914434666",
            //         "contactEmail": "alauddinc@epicbd.com",
            //         "addEditManufacturer": "Epic Garments Manufacturing Co. Ltd.",
            //         "emailAddressToReceiveFCR": "alauddinc@epicbd.com",
            //         "shipperName": "Epic Garments DWC LLC"
            //     }
            // }
            // handleCloseModal();
            handleClose();
            console.log("data", data);
            setOriginalTableBodyDataOfPulledFromEngine([]);
            setTableBodyDataOfPulledFromEngine([]);
            const p = await window?.engine?.startProcess(data);
            console.log("start process", p)
            if (p?.success === true) {
                setEngineStatus("Started");
                setPageOfPulledFromEngine(0)
                setTableBodyDataOfPulledFromEngine([]);
                setOriginalTableBodyDataOfPulledFromEngine([]);
                setIsProcessing(true);
            } else {
                setEngineStatus("Start Failed");
            }
        } catch (e) {
            console.log(e);
        }
    };

    const handleStart = async (e) => {
        e.preventDefault();
        if (
            (formData?.userName ?? '').trim() === '' ||
            (formData?.password ?? '').trim() === '' ||
            (formData?.excelFile ?? '').trim() === ''
        ) {
            console.log(formData)
            setEngineError('You must fill in all compulsory fields (*).');
            return;
        }
        if (
            formData?.settings?.downloadPoItems === false &&
            formData?.settings?.downloadPdf === false
        ) {
            setEngineError('Please select at least one download option (PO Items or PDF).');
            return;
        }
        else {
            setEngineError(null);
        }
        startEngine(formData);
    }

    // trigger engine stop
    const handleStop = async () => {
        const p = await window?.engine?.stopProcess();
        console.log("stop process", p);
        if (p?.success === true) {
            setEngineStatus("Stopped");
        }
    };

    return (
        <div className="px-1">
            <LoaderPage open={isLoading} />
            <div className="flex justify-between w-full">
                <div className="flex items-center gap-2 mt-1">
                    <StickyInstructions
                        title={"Booking Download (Amazon)"}
                        note={"Ensure your Excel file contains a 'Booking Number' column. The automation will navigate to each booking in Century VMS and download the PO Item files and/or Booking Confirmation PDF based on your selected options."}
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
                            {isExpandTimer ?
                                <ClearIcon
                                    sx={{
                                        color: "red",
                                        cursor: "pointer",
                                        fontSize: 20
                                    }}
                                    onClick={() => setIsExpandTimer(false)}
                                /> :
                                <div className="flex items-center justify-between gap-1" onClick={() => setIsExpandTimer(true)}>
                                    <TimerOutlinedIcon
                                        sx={{
                                            color: "#707070",
                                            cursor: "pointer"
                                        }}
                                    // onClick={() => setIsExpandTimer(true)}
                                    />
                                    {isExpandMiniTimer && <div className="flex flex-col items-center cursor-pointer">
                                        <p className="font-bold tracking-wide font-roboto text-sm text-[#1976d2]"><span className="flex">
                                            {String(Math.floor(seconds / 3600)).padStart(2, "0")} :{" "}
                                            {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")} :{" "}
                                            {String(seconds % 60).padStart(2, "0")}
                                        </span></p>
                                        <p className="font-bold tracking-wide font-roboto text-sm">Pulled: {succeed}</p>
                                    </div>}
                                </div>}
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
                            {isExpandMessage ?
                                <ClearIcon
                                    sx={{
                                        color: "gray",
                                        cursor: "pointer",
                                        fontSize: 20
                                    }}
                                    onClick={() => setIsExpandMessage(false)}
                                /> :
                                <EmailOutlinedIcon
                                    sx={{
                                        color: "gray",
                                        cursor: "pointer"
                                    }}
                                    onClick={() => setIsExpandMessage(true)}
                                />}
                        </Paper>
                    </Tooltip>
                    <FormatDownload />
                    <SettingsMenu onSettingsChange={handleSettingsUpdated} />
                </div>
            </div>
            <ProcessController
                open={open}
                handleClose={handleClose}
                isProcessing={isProcessing}
                isStartVisible={isStartVisible}
                engineError={engineError}
                handleStop={handleStop}
                handleStart={handleStart}
                isGettingData={isGettingData}
                setIsGettingData={setIsGettingData}
                formData={formData}
                setFormData={setFormData}
            // confirmLogin={confirmStart}
            />
            <div
                className={`flex ${(isExpandTimer && isExpandMessage) ? "gap-2" : "gap-0"} w-full overflow-hidden pt-2`}
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
                    open={open}
                    handleClose={handleClose}
                />
                <MessageTable
                    isExpandMessage={isExpandMessage}
                    setIsExpandMessage={setIsExpandMessage}
                    chnl={chanel}
                    isExpandStatus={isExpandStatus}
                    setIsExpandStatus={setIsExpandStatus}
                />
            </div>
            <PulledDataFromEngine
                isProcessing={isProcessing}
                handleStop={handleStop}
                handleOpen={handleOpen}
                pageOfPulledFromEngine={pageOfPulledFromEngine}
                setPageOfPulledFromEngine={setPageOfPulledFromEngine}
                rowsPerPageOfPulledFromEngine={rowsPerPageOfPulledFromEngine}
                setRowsPerPageOfPulledFromEngine={setRowsPerPageOfPulledFromEngine}
                tableBodyDataOfPulledFromEngine={tableBodyDataOfPulledFromEngine}
                setTableBodyDataOfPulledFromEngine={setTableBodyDataOfPulledFromEngine}
                originalTableBodyDataOfPulledFromEngine={originalTableBodyDataOfPulledFromEngine}
                setOriginalTableBodyDataOfPulledFromEngine={setOriginalTableBodyDataOfPulledFromEngine}
            />
        </div>
    )
}

export default DownloadPO;