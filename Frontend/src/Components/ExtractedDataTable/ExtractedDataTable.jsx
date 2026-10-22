/***********************************************************************/
/************************* Function Name: ExtractedDataTable********************* 
/************************* Creator Name: Rajib *********************/
/************************ Creation Date: 20-Jan-2025 *******************/
/********************** Modification Date: 21-Jan-2025 *****************/


/************************** ExtractedDataTable start ********************/

import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import React from 'react';
import ExtractedDataTableRow from '../../pages/ProcessExtraction/ExtractedDataTableRow';
import { getHeadersToShowInTable,getDataKeysToShowInTable, getFullHeaders } from '../../Functions/lib'


const ExtractedDataTable = ({headers,dataKeys = getDataKeysToShowInTable(),finalData,handleChange,handleDelete,page,rowsPerPage,showRowStatus=true}) => {

    const cellStyle= {
        color: 'white',
        backgroundColor: "#409cff",
        whiteSpace: "nowrap",
        textAlign: "center",
        borderRight: 1,
        borderColor: "white",
        fontSize: 14
    }

    const stickyCellStyle={
        ...cellStyle,
        position: 'sticky',
        right: 0
    }

    return (
        <Table
            sx={{
                borderTopLeftRadius: 5,
                // overflow: "hidden",
            }}
            stickyHeader
            aria-label="sticky table"
            size="small"
        >
            <TableHead>
                <TableRow>
                    {getHeadersToShowInTable()?.map(
                        (header, index) =>
                            header !== "Success" &&
                             (
                                <TableCell
                                    key={index}
                                     sx={cellStyle}
                                >
                                    <p className="w-[200px]">{header}</p>
                                </TableCell>
                            )
                    )}
                    <TableCell
                        sx={stickyCellStyle}
                    >
                        Action
                    </TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {finalData &&
                    finalData?.length > 0 &&
                    finalData
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((dataRow, index) => (
                            <ExtractedDataTableRow
                                key={index}
                                index={index}
                                dataKeys={dataKeys}
                                dataObj={dataRow}
                                showRowStatus={showRowStatus}
                                finalData={finalData}
                                handleChange={handleChange}
                                handleDelete={handleDelete}
                                
                            />
                        ))}
            </TableBody>
        </Table>
    );
};

export default ExtractedDataTable;

/************************** ExtractedDataTable end ********************/
