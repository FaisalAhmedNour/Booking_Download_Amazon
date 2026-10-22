/***********************************************************************/
/************************* Function Name: ExportExcelButton********
/************************* Creator Name: Faisal *********************/
/************************ Creation Date: -Jan-2025 *******************/
/************************* Modified by: Rajib *********************/
/********************** Modification Date: 22-Jan-2025 *****************/

import { useState } from 'react';
import Button from '@mui/material/Button';
import Loader from './Loader';
import {convertToNormalDate, getDateDataTypes, getShortHeaders} from '../Functions/lib'

/************************** ExportExcelButton start ********************/
const convertISOtoNormalDate = (IsoDate) => {
    try {
      // const parts = IsoDate.split("T");
      // return parts[0];
      return convertToNormalDate(IsoDate);
    } catch (e) {
      return " ";
    }
  };

  const prepareData = (dataArray) => {
    console.log(dataArray);  // Log the original dataArray
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
          // console.log("Sending date:",modifiedDataObj[dateKey])
          modifiedDataObj[dateKey] = convertToNormalDate(modifiedDataObj[dateKey]);
        //   console.log(modifiedDataObj[dateKey])
        }
      }
  
      // Return the modified object
    //   console.log(modifiedDataObj)
      return modifiedDataObj;
    });
  
    // Return the new array with the modified objects
    console.log(modifiedDataArray)
    return modifiedDataArray;
  }
  
  

const ExportExcelButton = ({
    data,
    headers,
    filename,
    includeTable,
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [dataKeys, setDataKeys] = useState(getShortHeaders);
    
    // let preparedData = prepareData(data);


    const exportToExcel = async () => {
        setIsDownloading(true);
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        let preparedData = prepareData(data);

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
                rows: preparedData?.map(row => dataKeys?.map(header => row[header])),
            });
        }
        else {
            worksheet.addRow(headers);

            preparedData.forEach(row => {
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
    };

    return (
        <Button
            size='small'
            variant='outlined'
            disabled={isDownloading}
            onClick={exportToExcel}
            sx={{ whiteSpace: 'nowrap', width: '100%', height: 25 }}
        >
            {isDownloading ? <Loader /> : "Export to Excel"}
        </Button>
    );
};

export default ExportExcelButton;
/************************** ExportExcelButton end ********************/
