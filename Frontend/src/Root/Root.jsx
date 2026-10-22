// Faisal (C) 7 April 2025

import React, { useEffect, useRef, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import DataPulling from '../pages/DataPulling/DataPulling';
import UploadedPulledData from '../pages/PulledData/UploadedPulledData';
import { convertToISODate } from '../Functions/DateConvertion';
import { headerKeysForPulling, headersForPulling } from '../pages/DataPulling/lib';
import Swal from 'sweetalert2';

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

const Root = () => {
    // tab
    const [value, setValue] = useState(0);
    // engine
    const [engineStatus, setEngineStatus] = useState(null);
    // flag
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStartVisible, setIsStartVisible] = useState(true);
    const [isUploadButtonVisible, setIsUploadButtonVisible] = useState(false);
    const [isExpandStatus, setIsExpandStatus] = useState(false);
    // form data
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    // loading
    const [isLoading, setIsLoading] = useState(false);
    // error
    const [uploadError, setUploadError] = useState(null);
    const [engineError, setEngineError] = useState(null);
    // reload
    const [reloadPulledData, setReloadPulledData] = useState(false);
    const [reloadUploadedData, setReloadUploadedData] = useState(false);
    // pulled Data table from engine
    const [pageOfPulledFromEngine, setPageOfPulledFromEngine] = useState(0);
    const [rowsPerPageOfPulledFromEngine, setRowsPerPageOfPulledFromEngine] = useState(5);
    const [tableBodyDataOfPulledFromEngine, setTableBodyDataOfPulledFromEngine] = useState([]);
    const [originalTableBodyDataOfPulledFromEngine, setOriginalTableBodyDataOfPulledFromEngine] = useState([]);
    // pulled data table
    const [pageOfUploaded, setPageOfUploaded] = useState(0);
    const [rowsPerPageOfUploaded, setRowsPerPageOfUploaded] = useState(10);
    const [totalRowsOfUploaded, setTotalRowsOfUploaded] = useState(0);
    const [tableBodyDataOfUploaded, setTableBodyDataOfUploaded] = useState([]);
    const [tableHeadersOfUploaded, setTableHeadersOfUploaded] = useState([]);
    const [errorForUploadedPulledData, setErrorForUploadedPulledData] = useState(null);
    const [queryOfUploadedPulledData, setQueryOfUploadedPulledData] = useState({ page: 0, setPage: 5 });

    // Engine start signal
    const getEngineOnSignal = () => {
        window?.engine?.onProcessStart(function (message) {
            setIsProcessing(true);
        });
    };
    // engine stop signal
    const getEngineOffSignal = () => {
        window?.engine?.onProcessStop(function (message) {
            setIsProcessing(false);
        });
    };

    const handleUploadPart = async (data) => {
        const uploadedFileData = {
            scope: 'SS',
            data: data,
        };
        console.log("uploadedFileData", uploadedFileData);
        try {
            const result = await window?.engine?.Proxy("/process/PO/data", 'post', uploadedFileData);
            console.log('Upload result', result);

            if (result?.data?.success === true) {
                // setIsUploadButtonVisible(false);
                setReloadPulledData(prev => !prev);
                // setFinalData([]); // Reset the final data after successful upload
            }
            else {
                throw new Error(result.data.message || "Failed to upload. Please try again.");
            }
        } catch (error) {
            console.error("Upload failed: ", error);
            Swal.fire({
                title: "Failed!",
                text: error?.message || error?.data?.message || "Failed to upload. Please try again.",
                icon: "error",
            });
        }
    };

    const bufferRef = useRef([]);
    const timerRef = useRef(null);

    useEffect(() => {
        getEngineOnSignal();
        getEngineOffSignal();

        let isMounted = true;

        const flushBuffer = () => {
            if (bufferRef.current.length > 0 && isMounted) {
                handleUploadPart(bufferRef.current);
                bufferRef.current = [];
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const handleTableData = (dt) => {
            console.log('row', dt);
            if (!isMounted) return;
        };

        window?.engine?.onTableData(handleTableData);

        // Cleanup function to prevent state update after unmount
        return () => {
            isMounted = false;
            // if (timerRef.current) clearTimeout(timerRef.current);
            // bufferRef.current = [];
        };
    }, []);

    // trigger engine start
    const startEngine = async (data) => {
        try {
            // console.log("data", data);
            setOriginalTableBodyDataOfPulledFromEngine([]);
            setTableBodyDataOfPulledFromEngine([]);
            const p = await window?.engine?.startProcess(data);
            // console.log(p)
            if (p.success === true) {
                setEngineStatus("Started");
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
        const data = {
            to: convertToISODate(to),
            form: convertToISODate(from),
            action: "coll_po"
        };
        startEngine(data);
    }
    // trigger engine stop
    const handleStop = async () => {
        const p = await window?.engine?.stopProcess();
        if (p.success === true) {
            setEngineStatus("Stopped");
            setIsProcessing(false);
        }
    };

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <div className='w-[calc(100vw - 20px)]'>
            <DataPulling
                from={from}
                setFrom={setFrom}
                to={to}
                setTo={setTo}
                isExpandStatus={isExpandStatus}
                setIsExpandStatus={setIsExpandStatus}
                engineStatus={engineStatus}
                engineError={engineError}
                handleStop={handleStop}
                handleStart={handleStart}
                isLoading={isLoading}
                isProcessing={isProcessing}
                isStartVisible={isStartVisible}
                setIsLoading={setIsLoading}
                uploadError={uploadError}
                setUploadError={setUploadError}
                setReloadPulledData={setReloadPulledData}
                isUploadButtonVisible={isUploadButtonVisible}
                setIsUploadButtonVisible={setIsUploadButtonVisible}
                pageOfPulledFromEngine={pageOfPulledFromEngine}
                setPageOfPulledFromEngine={setPageOfPulledFromEngine}
                rowsPerPageOfPulledFromEngine={rowsPerPageOfPulledFromEngine}
                setRowsPerPageOfPulledFromEngine={setRowsPerPageOfPulledFromEngine}
                // totalRowsOfPulledFromEngine={totalRowsOfPulledFromEngine}
                tableBodyDataOfPulledFromEngine={tableBodyDataOfPulledFromEngine}
                setTableBodyDataOfPulledFromEngine={setTableBodyDataOfPulledFromEngine}
                originalTableBodyDataOfPulledFromEngine={originalTableBodyDataOfPulledFromEngine}
                setOriginalTableBodyDataOfPulledFromEngine={setOriginalTableBodyDataOfPulledFromEngine}
            />
            <UploadedPulledData
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                errorForUploadedPulledData={errorForUploadedPulledData}
                setErrorForUploadedPulledData={setErrorForUploadedPulledData}
                queryOfUploadedPulledData={queryOfUploadedPulledData}
                setQueryOfUploadedPulledData={setQueryOfUploadedPulledData}
                reloadPulledData={reloadPulledData}
                pageOfUploaded={pageOfUploaded}
                setPageOfUploaded={setPageOfUploaded}
                rowsPerPageOfUploaded={rowsPerPageOfUploaded}
                setRowsPerPageOfUploaded={setRowsPerPageOfUploaded}
                totalRowsOfUploaded={totalRowsOfUploaded}
                setTotalRowsOfUploaded={setTotalRowsOfUploaded}
                tableBodyDataOfUploaded={tableBodyDataOfUploaded}
                setTableBodyDataOfUploaded={setTableBodyDataOfUploaded}
                tableHeadersOfUploaded={tableHeadersOfUploaded}
                setTableHeadersOfUploaded={setTableHeadersOfUploaded}
            />
            {/* <Box
                sx={{ width: '100%' }}
            >
                <Box
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider'
                    }}
                >
                    <Tabs
                        value={value}
                        onChange={handleChange}
                        sx={{ py: 0, minHeight: 30, borderTop: 0 }}
                    >
                        <Tab
                            sx={{
                                py: 0,
                                minHeight: 30,
                                border: 1,
                                borderTopLeftRadius: 5,
                                borderTopRightRadius: 5
                            }}
                            label="Data Pulling"
                            {...a11yProps(0)}
                        />
                        <Tab
                            sx={{
                                py: 0,
                                minHeight: 30,
                                border: 1,
                                borderTopLeftRadius: 5,
                                borderTopRightRadius: 5
                            }}
                            label="Uploaded Pulled Data"
                            {...a11yProps(1)}
                        />
                    </Tabs>
                </Box>

                <div className={`${value !== 0 && 'hidden'}`}>
                    <DataPulling
                        from={from}
                        setFrom={setFrom}
                        to={to}
                        setTo={setTo}
                        isExpandStatus={isExpandStatus}
                        setIsExpandStatus={setIsExpandStatus}
                        engineStatus={engineStatus}
                        engineError={engineError}
                        handleStop={handleStop}
                        handleStart={handleStart}
                        isLoading={isLoading}
                        isProcessing={isProcessing}
                        isStartVisible={isStartVisible}
                        setIsLoading={setIsLoading}
                        uploadError={uploadError}
                        setUploadError={setUploadError}
                        setReloadPulledData={setReloadPulledData}
                        isUploadButtonVisible={isUploadButtonVisible}
                        setIsUploadButtonVisible={setIsUploadButtonVisible}
                        pageOfPulledFromEngine={pageOfPulledFromEngine}
                        setPageOfPulledFromEngine={setPageOfPulledFromEngine}
                        rowsPerPageOfPulledFromEngine={rowsPerPageOfPulledFromEngine}
                        setRowsPerPageOfPulledFromEngine={setRowsPerPageOfPulledFromEngine}
                        // totalRowsOfPulledFromEngine={totalRowsOfPulledFromEngine}
                        tableBodyDataOfPulledFromEngine={tableBodyDataOfPulledFromEngine}
                        setTableBodyDataOfPulledFromEngine={setTableBodyDataOfPulledFromEngine}
                        originalTableBodyDataOfPulledFromEngine={originalTableBodyDataOfPulledFromEngine}
                        setOriginalTableBodyDataOfPulledFromEngine={setOriginalTableBodyDataOfPulledFromEngine}
                    />
                </div>

                <div className={`${value !== 1 && 'hidden'}`}>
                    <UploadedPulledData
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        errorForUploadedPulledData={errorForUploadedPulledData}
                        setErrorForUploadedPulledData={setErrorForUploadedPulledData}
                        queryOfUploadedPulledData={queryOfUploadedPulledData}
                        setQueryOfUploadedPulledData={setQueryOfUploadedPulledData}
                        reloadPulledData={reloadPulledData}
                        pageOfUploaded={pageOfUploaded}
                        setPageOfUploaded={setPageOfUploaded}
                        rowsPerPageOfUploaded={rowsPerPageOfUploaded}
                        setRowsPerPageOfUploaded={setRowsPerPageOfUploaded}
                        totalRowsOfUploaded={totalRowsOfUploaded}
                        setTotalRowsOfUploaded={setTotalRowsOfUploaded}
                        tableBodyDataOfUploaded={tableBodyDataOfUploaded}
                        setTableBodyDataOfUploaded={setTableBodyDataOfUploaded}
                        tableHeadersOfUploaded={tableHeadersOfUploaded}
                        setTableHeadersOfUploaded={setTableHeadersOfUploaded}
                    />
                </div>
            </Box> */}
        </div>
    );
};

export default Root;
