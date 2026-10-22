/***********************************************************************/
/************************* Function Name: ExportSavedDataButton********
/************************* Creator Name: Rajib *********************/
/************************ Creation Date: 22-Jan-2025 *******************/
/************************* Modified by: Rajib *********************/
/********************** Modification Date: 30-Jan-2025 *****************/

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal'
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CancelPresentationRoundedIcon from '@mui/icons-material/CancelPresentationRounded';
import {convertToNormalDate, getDateDataTypes, getFullHeaders, getShortHeaders} from '../../Functions/lib'
import ErrorPage from '../ErrorPage';

/************************** ExportSavedDataButton start ********************/

const convertISOtoNormalDate = (IsoDate) => {
    try {
      const parts = IsoDate.split("T");
      return parts[0];
    } catch (e) {
      return "";
    }
  };

  const prepareData = (dataArray) => {
    // console.log(dataArray);  // Log the original dataArray
    const dates = getDateDataTypes();
    
    // Create a new array with the modified data
    const modifiedDataArray = dataArray.map(dataObj => {
      // Create a shallow copy of the dataObj to avoid mutating the original
      const modifiedDataObj = { ...dataObj };
  
      // Loop through the dates and modify the copied object
      for (let dateKey of dates) {
        // console.log(dateKey)
        if (modifiedDataObj.hasOwnProperty(dateKey)) {
          // modifiedDataObj[dateKey] = convertISOtoNormalDate(modifiedDataObj[dateKey]);
          modifiedDataObj[dateKey] = convertToNormalDate(modifiedDataObj[dateKey]);
        //   console.log(modifiedDataObj[dateKey])
        }
      }
  
      // Return the modified object
    //   console.log(modifiedDataObj)
      return modifiedDataObj;
    });
  
    // Return the new array with the modified objects
    // console.log(modifiedDataArray)
    return modifiedDataArray;
  }


const ExportSavedDataButton = ({
    data,
    // headers,
    filename,
    includeTable,
    fetchAllDataForExport,
    fetchCurrentPageForExport,
    progress,
    isProcessStoppedRef, setIsProcessStopped
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [dataKeys, setDataKeys] = useState(getShortHeaders);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const headers = getFullHeaders();
    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: '#f5fbff',
        border: '1px solid #1d92d1',
        borderRadius: '8px',
        boxShadow: 24,
        p: 4,
      };

    //   useEffect(()=>{
    //     setError('')
    //     setIsProcessStopped(false)
    //   },[open])
      
    const exportToExcel = async (dataToExport) => {
        setIsDownloading(true);
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        dataToExport = prepareData(dataToExport);
        console.log("prepared data: ",dataToExport)

        if (includeTable) {
            worksheet.addTable({
                name: 'MyTable',
                ref: `A1`,
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true,
                },
                columns: headers.map(header => ({ name: header, filterButton: true })),
                rows: dataToExport?.map(row => dataKeys?.map(header => row[header])),
            });
        }
        else {
            worksheet.addRow(headers);

            dataToExport.forEach(row => {
                worksheet.addRow([row?.id, row?.title, row?.completed]);
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${includeTable ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsDownloading(false);
        setOpen(false);
    };

    const handleClick = () =>{
        console.log("Clicked export");
        setError('')
        setIsProcessStopped(false)
        setOpen(true)
    }

    const handleModalClose = ()=>{
        setOpen(false);
        setError('')
        console.log("Model closed")
        setIsDownloading(false);
        setIsProcessStopped(true);
    }

    const handleCurrentPageExport = async (e)=>{
        // e.stopPropagation();
        // exportToExcel(data);
        console.log("Current page is exporting");
        setError('');
        setIsDownloading(true);
        setIsProcessStopped(false);
        const data = await fetchCurrentPageForExport();
        if (isProcessStoppedRef.current){
            setError('')
            return;
        }
        else if (!data || data.length == 0){
            setError("Couldn't retrieve data.");
            setIsDownloading(false);
        }
        else{
            // exportToExcel(data);
            exportToExcel(prepareData(data));
        }
    }

    const handleAllPagesExport = async ()=>{
        
        console.log("All pages are exporting");
        setError('');
        setIsProcessStopped(false);
        setIsDownloading(true);
        const data = await fetchAllDataForExport();
        if (isProcessStoppedRef.current){
            setError('')
            return;
        }
        else if (!data || data.length == 0){
            console.log(isProcessStoppedRef.current)
            setError("Couldn't retrieve data.");
            setIsDownloading(false);
        }
        
        else{
            console.log("Process Stop state:",isProcessStoppedRef.current)
            // exportToExcel(data);
            exportToExcel(prepareData(data));
        }
    }

    const handleClose = ()=>{
        console.log('stop clicked')
        setIsDownloading(false);
        setError('')
        setIsProcessStopped(true);
    }


    // const [progress, setProgress] = useState(10);

    // useEffect(() => {
    //   const timer = setInterval(() => {
    //     setProgress((prevProgress) => (prevProgress >= 100 ? 10 : prevProgress + 10));
    //   }, 800);
    //   return () => {
    //     clearInterval(timer);
    //   };
    // }, []);


    

    return (
        <>
            <Button
                size='small'
                variant='outlined'
                disabled={isDownloading}
                onClick={handleClick}
                sx={{ whiteSpace: 'nowrap', width: '100%', height: 25 }}
                >
                    Export to Excel
            </Button>

            <Modal
                  aria-labelledby="transition-modal-title"
                  aria-describedby="transition-modal-description"
                  open={open}
                  onClose={(event, reason) => {
                    if (reason === "backdropClick") {
                      return; 
                    }
                    handleClose(); 
                  }}
                  closeAfterTransition
                  slots={{ backdrop: Backdrop }}
                  slotProps={{
                    backdrop: {
                      timeout: 500,
                    },
                  }}
                >


                  <Fade in={open}>
                  
                    <Box sx={style}>
                        <CancelPresentationRoundedIcon
                            onClick={handleModalClose}
                            style={{
                                color:"#17a4e6",
                                position:'absolute',
                                top:0,
                                right:2,
                                fontSize:25,
                                cursor: "pointer"
                        }}/>
                        {
                        error?<ErrorPage error={error} setError={setError}></ErrorPage>:
                            isDownloading?
                            (
                            <Box sx ={{display:'flex', flexDirection:'column'}}>
                                
                                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                      Exporting
                                    </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box sx={{ width: '100%', mr: 1 }}>
                                    <LinearProgress variant="determinate" value={progress} />
                                  </Box>
                                  <Box sx={{ minWidth: 35 }}>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      {`${Math.round(progress)}%`}
                                    </Typography>
                                  </Box>
                                </Box>
                            </Box>
                            ):
                            (
                                <>
                                
                                    {/* <CancelPresentationRoundedIcon
                                        onClick={handleModalClose}
                                        style={{
                                            color:"#17a4e6",
                                            position:'absolute',
                                            top:0,
                                            right:2,
                                            fontSize:25,
                                            cursor: "pointer"
                                    }}/> */}

                                    <div className='flex flex-col gap-5'>
                                        <Button
                                            size='small'
                                            variant='outlined'
                                            onClick={handleCurrentPageExport}
                                            sx={{ whiteSpace: 'nowrap', width: '100%', height: 25, }}
                                            >
                                            Export Current Page
                                        </Button>
                                        <Button
                                            size='small'
                                            variant='outlined'
                                            onClick={handleAllPagesExport}
                                            sx={{ whiteSpace: 'nowrap', width: '100%', height: 25 }}
                                            >
                                            Export All Pages
                                        </Button>
                                    </div>
                                </>
                            )
                        }
                    </Box>
                  </Fade>
            </Modal>
        </>
    );
};

export default ExportSavedDataButton;
/************************** ExportSavedDataButton end ********************/
