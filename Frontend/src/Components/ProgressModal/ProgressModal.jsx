import { Backdrop, Box, Fade, Modal } from '@mui/material';
import React from 'react';
import { useState } from 'react';
import ErrorPage from '../ErrorPage';
import CancelPresentationRoundedIcon from '@mui/icons-material/CancelPresentationRounded';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

const ProgressModal = ({ progress, open, setOpen, error, setError, title, setIsProcessStopped }) => {
  const [uploading, setIsUploading] = useState(true);

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

  const handleModalClose = () => {
    setOpen(false);
    setError('')
    console.log("Model closed")
    setIsUploading(false);
    setIsProcessStopped(true);
  }

  return (
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
              color: "#17a4e6",
              position: 'absolute',
              top: 0,
              right: 2,
              fontSize: 25,
              cursor: "pointer"
            }} />
          {
            error ? <ErrorPage error={error} setError={setError}></ErrorPage>
              :
              (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>

                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    {title}
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
              )
          }
        </Box>
      </Fade>
    </Modal>
  );
};

export default ProgressModal;