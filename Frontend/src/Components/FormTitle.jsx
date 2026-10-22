import Typography from "@mui/material/Typography";

const FormTitle = ({ text, isCompulsory, length }) => {
    return (
        <Typography
            sx={{
                width: `${length}px`,
                fontSize: '14px',
                fontWeight: 400,
                display: 'flex',
                justifyContent: "space-between",
                alignItems: 'center',
                userSelect: 'none'

            }}
        >
            <span>{text}{isCompulsory && <span className='text-[red]'>*</span>}</span><span> :</span>
        </Typography>
    );
};

export default FormTitle;