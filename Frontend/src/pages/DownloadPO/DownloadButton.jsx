import { LoadingButton } from '@mui/lab';
import { Button } from '@mui/material';
import React from 'react';

const DownloadButton = ({ onClick, isLoading = false, isDisabled = false }) => {
    return (
        <LoadingButton
            onClick={onClick}
            loading={isLoading}
            disabled={isDisabled}
            size='small'
            variant='outlined'
            sx={{ height: 25 }}
        >
            Download as Excel
        </LoadingButton>
    );
};

export default DownloadButton;