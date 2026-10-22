import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';

const Loader = () => {
    return (
        <Stack
            sx={{ 
                color: 'grey.500',
                display: 'flex',
                justifyContent: 'center',
                marginY: 5
             }}
            direction="row"
        >
            <CircularProgress color="inherit" />
        </Stack>
    );
};

export default Loader;