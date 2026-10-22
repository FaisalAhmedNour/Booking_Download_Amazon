import React from 'react';
import Typography from "@mui/material/Typography";
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';


const ErrorPage = ({error="Error! Something happened.", setError}) => {
    return (
        <div className="flex bg-slate-300 py-4 rounded-md justify-center items-center gap-2 mt-1">
                      <Typography
                          fontSize={14}
                          sx={{
                              textAlign: "center",
                              color: '#eb091c'
                              }}>
                              {error}
                      </Typography>
                      
                      <CancelOutlinedIcon
                      onClick= {()=>setError('')}
                      sx ={{
                          color:"#eb091c"
                      }}
                      ></CancelOutlinedIcon>
                  </div>
    );
};

export default ErrorPage;