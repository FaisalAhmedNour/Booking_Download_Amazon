import Typography from "@mui/material/Typography";

const ProcessHeader = ({ title }) => {
    return (
        <Typography
            textAlign='center'
            fontSize='24px'
            fontWeight='700'
            color={'#424e79'}
        >{title}</Typography>
    );
};

export default ProcessHeader;