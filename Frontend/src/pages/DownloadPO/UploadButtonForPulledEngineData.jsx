import Button from '@mui/material/Button';
import React from 'react';

const UploadButtonForPulledEngineData = ({ onClick, isUploadButtonVisible = false }) => {
    // console.log(isUploadButtonVisible)
    return (
        <Button
            onClick={onClick}
            variant='outlined'
            size='small'
            disabled={isUploadButtonVisible}
            sx={{
                height: 25
            }}
        >
            Upload
        </Button>
    );
};

export default UploadButtonForPulledEngineData;