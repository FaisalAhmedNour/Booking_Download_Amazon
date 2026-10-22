// Faisal (C) 9 April 2025

import React from 'react';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MessageTableHeadRow from './MessageTableHeadRow';

const MessageTableHead = ({ titles }) => {
    const titleStyle = {
        fontWeight: 400,
        minWidth: 120,
        backgroundColor: "#409cff",
        color: 'white',
        whiteSpace: "nowrap",
        fontSize: 14,
    }

    return (
        <TableHead>
            <TableRow>
                {
                    titles.map((title, ind) => (
                        <MessageTableHeadRow key={ind} title={title} ind={ind} ></MessageTableHeadRow>
                    ))
                }
            </TableRow>
        </TableHead>
    );
};

export default MessageTableHead;
/************************** MessageTableHead end ********************/
