import {
    Box,
    Modal,
    Typography,
} from "@mui/material";
import { useState } from "react";
import CloseIcon from '@mui/icons-material/Close';

const style2 = {
    position: 'absolute',
    top: '50%',
    left: '58%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    p: 4,
    border: 0,
    borderRadius: 2
};

const TitleNote = ({ title, note }) => {
    const [open5, setOpen5] = useState(false);

    const handleOpen5 = () => {
        setOpen5(true)
    };

    const handleClose5 = () => {
        setOpen5(false)
    }

    return (
        <div className="absolute top-0 -right-[72px]">
            <Typography
                onClick={handleOpen5}
                sx={{
                    border: 1,
                    paddingX: 1,
                    color: '#2e7d32',
                    fontSize: '10px',
                    cursor: 'pointer',
                    borderColor: '#2e7d32',
                    borderTopLeftRadius: 10,
                    borderBottomRightRadius: 10,
                }}
            >Instructions</Typography>
            {/* note tab */}
            <Modal
                open={open5}
                onClose={handleClose5}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style2}>
                    <div className="relative">
                        <span onClick={handleClose5} className="absolute -top-5 -right-4 cursor-pointer text-xl">
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

export default TitleNote;