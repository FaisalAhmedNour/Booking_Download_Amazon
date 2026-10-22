import Typography from "@mui/material/Typography";
import TitleNote from "./TitleNote";

const ProcessHeaderWithNote = ({ title, note }) => {
    return (
        <div className="flex justify-center">
            <div className="relative">
                <Typography
                    fontSize='24px'
                    fontWeight='700'
                    color={'#424e79'}
                    textAlign='center'
                >{title}</Typography>
                <TitleNote
                    title={title}
                    note={note}
                />
            </div>
        </div>
    );
};

export default ProcessHeaderWithNote;