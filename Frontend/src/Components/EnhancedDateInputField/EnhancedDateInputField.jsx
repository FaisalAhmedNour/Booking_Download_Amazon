import { useContext, useEffect, useRef, useState } from "react";
import moment from "moment";
import TextField from "@mui/material/TextField";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { convertToISODate, convertToNormalDate } from "../../Functions/lib";
import { data } from "autoprefixer";

const month = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const EnhancedDateInputField = ({
//   value,
//   setValue,
  dataKey, 
  dataObj,
  onDataChange =()=>{},
  formLength,
  formTitle,
  isCompulsory,
  dateToRestrict,
  both = false,
  futureDate = false,
}) => {
  const dateInputRef = useRef(null);
  const [value, setValue] = useState(dataObj[dataKey]);
  // const AuthContextInfo = useContext(AuthContext);
  // const [restrictDate, setRestrictDate] = useState(AuthContextInfo?.currentDate?.maxDate);

  // useEffect(() => {
  //     // console.log(dateToRestrict)
  //     if (dateToRestrict)
  //         setRestrictDate(dateToRestrict);
  //     if (value < dateToRestrict)
  //         setValue(dateToRestrict)
  // }, [dateToRestrict])

  const handleClick = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  const handleChange = (e) => {
    const date = e.target.value;
    if (typeof date === "string" && date.length > 0) {
      // console.log(date)
      setValue(date);
      const IsoDate = convertToISODate(date);
      dataObj[dataKey] = IsoDate;
      onDataChange(dataObj)
      console.log(dataObj)
    }
  };

  const enhancedMoment = (data) => {
    try {
      const normalDate = convertToNormalDate(data);
      if (!normalDate.length > 0) {
        return "";
      }
      const parts = normalDate.split("-");
      if (parts.length < 3) {
        return "";
      }

      const monthIndex = parseInt(parts[1]) - 1;
      return `${parts[2]} ${month[monthIndex]} ${parts[0]}`;
      
    } catch (error) {
      console.log(error);
      return "";
    }
  };

  const convertToRequiredFormat = (data) => {
    // data = (new Date(data)).toLocaleDateString();
    try{
      // console.log(data)
      // console.log(value)
      // console.log(dataObj)
      // console.log(dataKey)
      data = moment(data).format("YYYY-MM-DD")
      // console.log(data)
      return data;
    }
    catch(e){
      console.log(e);
      return ""
    }
    
  };

  return (
    <div className="flex gap-1 transform translate-x-2">
      <div className="flex flex-grow gap-1 w-full relative">
        <TextField
          size="small"
          placeholder="DD MMM YYYY"
          value={value ? moment(value).format("DD MMM YYYY") : ''}
          // value={value ? enhancedMoment(value) || "" : ""}
          className="editableInput"
          InputProps={{
            readOnly: true,
          }}
          onClick={handleClick}
          // onClick={() => document.getElementById('date-input').focus()}
          sx={{
            // width: "160px",
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
            right: 25,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 18,
            color: "#6c7a89",
          }}
          className="cursor-pointer"
          onClick={handleClick}
        />
        <input
          ref={dateInputRef}
          
          // id="date-input"
          type="date"
          onChange={handleChange}
          // defaultValue={value}
          value={convertToRequiredFormat(value)}
          required
          className="w-[0px] h-[0px] rounded"
          // max={both ? undefined : futureDate ? undefined : restrictDate}
          // min={both ? undefined : futureDate ? restrictDate : undefined}
        />
      </div>
    </div>
  );
};

export default EnhancedDateInputField;
