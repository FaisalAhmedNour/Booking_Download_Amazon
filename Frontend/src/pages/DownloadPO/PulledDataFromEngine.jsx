// Faisal (C) 11 August 2025

import React, { useEffect, useState } from 'react';
import CustomTable from '../../Components/CustomTable/CustomTable';
import { fullHeadersForPulling } from './lib';
import Pagination from '../../Components/CustomTable/Pagination/Pagination';
import Body from '../../Components/CustomTable/Body/Body';
import DownloadButton from './DownloadButton';
import exportToExcel from '../../Functions/exportToExcel';
import Button from '@mui/material/Button';
import { heightLightButton } from '../../lib';

const PulledDataFromEngine = ({
    isProcessing,
    handleStop,
    handleOpen,
    pageOfPulledFromEngine,
    setPageOfPulledFromEngine,
    rowsPerPageOfPulledFromEngine,
    setRowsPerPageOfPulledFromEngine,
    // totalRowsOfPulledFromEngine,
    tableBodyDataOfPulledFromEngine,
    setTableBodyDataOfPulledFromEngine,
    originalTableBodyDataOfPulledFromEngine,
    setOriginalTableBodyDataOfPulledFromEngine
}) => {
    const [finalDataToUpload, setFinalDataToUpload] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    // console.log("tableBodyDataOfPulledFromEngine", tableBodyDataOfPulledFromEngine);

    const onChangePage = (newPage) => {
        // console.log("newPage", newPage);
        setPageOfPulledFromEngine(newPage);
    };

    const onChangeRowsPerPage = (row) => {
        // console.log("row", row)
        setRowsPerPageOfPulledFromEngine(row);
        setPageOfPulledFromEngine(0);
    };

    const handleDownload = () => {
        exportToExcel(
            tableBodyDataOfPulledFromEngine,
            fullHeadersForPulling,
            'Booking Correction Status Data',
            setIsDownloading,
            true
        )
    }

    const handleClearTable = () => {
        setTableBodyDataOfPulledFromEngine([]);
    }

    return (
        <>
            <CustomTable
                headerTitle={"Response Data"}
                headerButtons={[
                    <>
                        {isProcessing ?
                            <Button
                                size='small'
                                variant='contained'
                                onClick={handleStop}
                                color='error'
                                sx={{
                                    height: 30,
                                    width: 150
                                    // textTransform: 'capitalize',
                                }}
                            >Stop</Button> :
                            <Button
                                size='small'
                                variant='contained'
                                onClick={handleOpen}
                                color='success'
                                sx={{
                                    ...heightLightButton,
                                    height: 30,
                                    width: 150
                                    // textTransform: 'capitalize',
                                }}
                            >Start</Button>
                        }
                    </>
                ]}
                pagination={<Pagination
                    page={pageOfPulledFromEngine}
                    rowsPerPage={rowsPerPageOfPulledFromEngine}
                    totalRows={tableBodyDataOfPulledFromEngine?.length || 0}
                    onChangePage={onChangePage}
                    onChangeRowsPerPage={onChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    leftButtons={[
                        <Button
                            size='small'
                            variant='outlined'
                            onClick={() => handleClearTable()}
                            color='error'
                            sx={{
                                height: 25
                            }}
                        >Clear</Button>,
                        <DownloadButton
                            onClick={handleDownload}
                            isDisabled={tableBodyDataOfPulledFromEngine?.length === 0}
                            isLoading={isDownloading}
                        />
                    ]}
                />}
                body={<Body
                    headers={fullHeadersForPulling}
                    bodyData={tableBodyDataOfPulledFromEngine?.slice(pageOfPulledFromEngine * rowsPerPageOfPulledFromEngine, (pageOfPulledFromEngine * rowsPerPageOfPulledFromEngine) + rowsPerPageOfPulledFromEngine)}
                />}
            />
        </>
    );
};

export default PulledDataFromEngine;