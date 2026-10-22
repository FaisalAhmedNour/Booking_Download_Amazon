// Faisal Ahmed (C) 9 April 2025
// Faisal Ahmed (M) - 13 Oct 2025

import { useEffect, useRef, useState } from "react";
import Table from "@mui/material/Table";
import Paper from "@mui/material/Paper";
import TableContainer from "@mui/material/TableContainer";
import MessageTableHead from "./MessageTableHead";
import MessageTableBody from "./MessageTableBody";
import Button from "@mui/material/Button";

const getStartingMessage = () => {
    const defaultMessage = {};
    defaultMessage.time = (new Date()).toLocaleTimeString();
    defaultMessage.message = 'Select the dates and click on "START PULLING" button to start the process.';
    defaultMessage.title = `Instructions`;

    return [defaultMessage];
}

const getEngineStartMessage = () => {
    const defaultMessage = {};
    defaultMessage.time = (new Date()).toLocaleTimeString();
    defaultMessage.message = 'The Engine is started and extracting the files';
    defaultMessage.title = 'Process started';

    return defaultMessage;
}

const MessageTable = ({ isExpandMessage, chnl }) => {
    const [messages, setMessages] = useState([]);
    const titles = ["Time Stamp", "Title", "Message"];

    // Use a ref to track if we've already registered the listener
    const isListenerRegistered = useRef(false);
    const currentChannelRef = useRef(chnl);

    useEffect(() => {
        if (!window.engine || typeof window?.engine?.onMessage !== "function") return;

        // Only register the listener once, not on every chnl change
        if (!isListenerRegistered.current) {
            const handler = function (msg) {
                // console.log('message', msg, "currentChannel", currentChannelRef.current);
                // Use the ref to get the current channel value
                if (msg?.channel === currentChannelRef.current) {
                    const messageData = {};
                    messageData.time = (new Date()).toLocaleTimeString();
                    messageData.message = msg.message;
                    messageData.title = msg.title;
                    // [n => 'normal', w => 'warning', e => 'error']
                    setMessages(prev => [messageData, ...prev]);
                }
            };

            window?.engine?.onMessage(handler);
            isListenerRegistered.current = true;
        }

        // Update the current channel ref when chnl changes
        currentChannelRef.current = chnl;

        // Clear messages when channel changes to avoid showing messages from previous channel
        setMessages([]);

        // No cleanup needed since we can't remove the listener
        return () => {
            // Note: offMessage method doesn't exist on window.engine
            // Event listeners will remain active until component unmounts
        };
    }, [chnl]);

    const handleClear = () => {
        setMessages([]);
    }

    return (
        <Paper sx={{ flexGrow: 1, height: isExpandMessage ? 180 : 0, transition: "width 1s, height 1s", position: 'relative' }}>
            <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                    height: isExpandMessage ? 180 : 0,
                    border: 0,
                    position: 'relative',
                    transition: "width 1s, height 1s",
                    scrollbarWidth: 'thin'
                }}
            >
                <Table
                    stickyHeader
                    sx={{ overflow: "scroll" }}
                    size="small"
                >
                    <MessageTableHead titles={titles} />
                    <MessageTableBody messages={messages}></MessageTableBody>
                </Table>
            </TableContainer>
            {isExpandMessage && <Button
                size="small"
                variant="outlined"
                onClick={handleClear}
                color="error"
                sx={{
                    position: 'absolute',
                    top: 1,
                    right: 12,
                    zIndex: 10,
                    height: 23.5,
                    color: 'red',
                    borderColor: 'red'
                }}
            >Clear</Button>}
        </Paper>
    )
}

export default MessageTable;
