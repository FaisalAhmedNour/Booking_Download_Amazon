import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import StickyNote2Icon from '@mui/icons-material/StickyNote2';

const style2 = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    p: 3,
    border: 0,
    borderRadius: 2,
    outline: 'none'
};
const StickyInstructions = ({ title, note }) => {
    const [open5, setOpen5] = useState(false);

    const handleOpen5 = () => {
        setOpen5(true)
    };

    const handleClose5 = () => {
        setOpen5(false)
    }

    return (
        <div className="flex justify-center">
            {/* Icon */}
            <Tooltip title={"Instructions"} arrow placement="right" disableInteractive>
                <Paper
                    sx={{
                        overflow: "hidden",
                        py: 1,
                        px: 1,
                        width: 40,
                        height: 40,
                        // maxHeight: 40,
                        // minHeight: 40,
                        // transition: "width 1s,max-height 1s, min-height 1s",
                    }}
                    className="space-y-1"
                    onClick={handleOpen5}
                >
                    <StickyNote2Icon
                        sx={{
                            color: "gray",
                            // rotate: "180deg",
                            cursor: "pointer",
                        }}
                    />
                </Paper>
            </Tooltip>
            {/* note tab */}
            <Modal
                open={open5}
                onClose={handleClose5}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style2}>
                    <div className="relative">
                        <span onClick={handleClose5} className="absolute -top-5 -right-4 cursor-pointer text-xl text-red-500">
                            <CloseIcon />
                        </span>
                        <Typography
                            sx={{
                                textAlign: 'center',
                                fontWeight: 600,
                                fontSize: '20px'
                            }}
                        >
                            {title}
                        </Typography>
                        <Typography id="modal-modal-title" sx={{ fontSize: '18px', fontWeight: 500 }}>
                            Note:
                        </Typography>
                        <Typography id="modal-modal-description" sx={{ mt: 2, textAlign: 'justify' }}>
                            {/* Though system have no records about invoice. UiCommercial offer you to download the standard format of Exp and fill up the required filed data by using copy paste process. Once you have download the format & filled up the data then you are ready for uploading the file in the UiCommercial portal. */}
                            {note}
                        </Typography>
                    </div>
                </Box>
            </Modal>
        </div>
    );
};

export default StickyInstructions;