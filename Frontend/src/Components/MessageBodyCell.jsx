import { TableCell } from '@mui/material';
import React from 'react';

const MessageBodyCell = ({ row,style }) => {
    const tableCells = [
        { key: "time", component: "th", scope: "row", align: "left" }, 
        { key: "title"},
        { key: "message" }
        
    ];

    return (
        <>
            {tableCells.map((cell, index) => (
                <TableCell
                    {...style}
                    {...cell} 
                >
                    {row?.[cell.key]}
                </TableCell>
            ))}
        </>
    );
};

export default MessageBodyCell;
