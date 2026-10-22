// Faisal Ahmed (C)
// Faisal Ahmed (M) - 11 August 2024

import { useEffect, useRef, useState } from "react"
import moment from "moment";
import TextField from "@mui/material/TextField";
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import FormTitle from "../FormTitle";

const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DateInputField = ({ value, setValue, formLength, formTitle, isCompulsory, dateToRestrict, both = false, futureDate = false }) => {
    const dateInputRef = useRef(null);
    const [restrictDate, setRestrictDate] = useState(moment(new Date()).format("yyyy-mm-dd"));

    useEffect(() => {
        // console.log(dateToRestrict)
        if (dateToRestrict)
            setRestrictDate(dateToRestrict);
        if (value < dateToRestrict)
            setValue(dateToRestrict)
    }, [dateToRestrict])

    const handleClick = () => {
        if (dateInputRef.current) {
            dateInputRef.current.showPicker();
        }
    };

    return (
        <div className="flex gap-1">
            <FormTitle text={formTitle} isCompulsory={isCompulsory} length={formLength} />
            <div className="flex flex-grow gap-1 relative  w-[300px]">
                <TextField
                    size="small"
                    placeholder="DD MMM YYYY"
                    value={value ? moment(value).format("DD MMM YYYY") : ''}
                    className="editableInput"
                    InputProps={{
                        readOnly: true,
                    }}
                    onClick={handleClick}
                    // onClick={() => document.getElementById('date-input').focus()}
                    sx={{
                        width: "160px",
                        "& .MuiInputBase-root": {
                            height: 25,
                            overflow: "hidden",
                            flexGrow: 1,
                            fontSize: 14,
                        },
                    }}
                />
                <CalendarMonthOutlinedIcon
                    sx={{
                        position: "absolute",
                        left: 140,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 18,
                        color: '#6c7a89'
                    }}
                    className="cursor-pointer"
                    onClick={handleClick}
                />
                <input
                    ref={dateInputRef}
                    // id="date-input"
                    type="date"
                    value={value || ''}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-[0px] h-[0px] rounded"
                    max={both ? undefined : futureDate ? undefined : restrictDate}
                    min={both ? undefined : futureDate ? restrictDate : undefined}
                />
            </div>
        </div>
    )
}

export default DateInputField;