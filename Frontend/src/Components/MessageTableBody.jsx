/***********************************************************************/
/************************* Function Name: MessageTableBody*********************/
/************************* Creator Name: Rajib *********************/
/************************ Creation Date: 08-Jan-2025 *******************/
/********************** Modification Date: 09-Jan-2025 *****************/


import { TableBody, TableRow } from '@mui/material';
import React from 'react';
import MessageBodyCell from './MessageBodyCell';


/************************** MessageTableBody start ********************/

const MessageTableBody = ({
    messages
}) => {
    const cellStyle = {
        sx: { fontSize: 14, py: '1px' },
        align: "left",
    };

    return (
        <TableBody
        className="max-h-20 over"
    >
        {
            messages &&
            messages?.length !== 0 &&
            messages.map((row, index) => (
                    <TableRow
                        key={index}
                        // sx={{
                        //     "&:nth-of-type(even)": {
                        //         backgroundColor: "#bee2fd",
                        //     },
                        //     "&:nth-of-type(odd)": {
                        //         backgroundColor: "#eeeeee",
                        //     },
                        // }}
                    >
                       <MessageBodyCell row={row} style={cellStyle}></MessageBodyCell>
                       
                    </TableRow>
                )
                )}
    </TableBody>
    );
};

export default MessageTableBody;
/************************** MessageTableBody end ********************/
