// Faisal Ahmed (C) 3 April 2025
// Faisal Ahmed (M) - 29 November 2025

import { useEffect, useRef, useState } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ClearIcon from '@mui/icons-material/Clear';

const TimerSection = ({
  isDataToRun,
  dataToRunText,
  isSuccess,
  successText,
  isFaild,
  chnl,
  isExpand,
  setIsExpand,
  setSucceed,
  seconds,
  setSeconds
}) => {
  const [successCount, setSuccessCount] = useState(0);
  const [dataToExtract, setDataToExtract] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [remainingTime, setRemainingTime] = useState('00:00');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  // Use ref to track the current timer id, to avoid stacking multiple timers
  const timerRef = useRef();
  const startTimeRef = useRef(null);

  // Ensure the timer is only running one instance, with proper cleanup
  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Record the real start time
    startTimeRef.current = Date.now();

    timerRef.current = setTimeout(function tick() {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      timerRef.current = setTimeout(tick, 1000);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartTime = () => {
    stopTimer();
    setSeconds(0);
    startTimeRef.current = Date.now();
    startTimer();
  };

  const handleStopTime = () => {
    stopTimer();
  };

  function calculateRemainingTime(total, complete, failed, speed) {
    const toDo = total - (complete + failed);
    return new Date(toDo * speed * 1000).toISOString().substring(14, 19);
  }

  // Use refs to track if listeners are already registered and current channel
  const isStatusListenerRegistered = useRef(false);
  const currentChannelRef = useRef(chnl);

  // Register onStatus listener only once, filter by current channel
  useEffect(() => {
    if (!window.engine?.onStatus) return;

    // Only register the listener once, not on every chnl change
    if (!isStatusListenerRegistered.current) {
      const handler = function (status) {
        let { channel, total, complete, failed, speed, title, details } = status;
        console.log('status', status, "currentChannel", currentChannelRef.current);
        // Use the ref to get the current channel value
        if (channel === currentChannelRef.current) {
          setSucceed(complete);
          if (typeof title === 'string') setTitle(title);
          if (typeof total === 'number') setDataToExtract(total);
          if (typeof complete === 'number') setSuccessCount(complete);
          if (typeof failed === 'number') setFailedCount(failed);
          if (typeof details === 'string') setDetails(details);
          if (typeof total === 'number' && typeof complete === 'number' && typeof failed === 'number') {
            setRemainingTime(calculateRemainingTime(total, complete, failed, speed));
          }
        }
      };

      window.engine.onStatus(handler);
      isStatusListenerRegistered.current = true;
    }

    // Update the current channel ref when chnl changes
    currentChannelRef.current = chnl;

    // Reset state when channel changes
    setSucceed(0);
    setTitle('');
    setDetails('');
    setDataToExtract(0);
    setSuccessCount(0);
    setFailedCount(0);
    setRemainingTime('00:00');

    // No cleanup needed since we can't remove the listener
    return () => {
      // Note: offStatus method doesn't exist on window.engine
      // Event listeners will remain active until component unmounts
    };
  }, [chnl, setSucceed]);

  // Use refs to track if process listeners are already registered
  const isProcessStartListenerRegistered = useRef(false);
  const isProcessStopListenerRegistered = useRef(false);

  // Single registration for onProcessStart and onProcessStop on mount
  useEffect(() => {
    // Only register onProcessStart listener once
    if (!isProcessStartListenerRegistered.current && window.engine?.onProcessStart) {
      const onStart = function () {
        console.log('Process started - starting timer');
        handleStartTime();
      };
      window.engine.onProcessStart(onStart);
      isProcessStartListenerRegistered.current = true;
    }

    // Only register onProcessStop listener once
    if (!isProcessStopListenerRegistered.current && window.engine?.onProcessStop) {
      const onStop = function () {
        console.log('Process stopped - stopping timer');
        setTitle("Stopped");
        setDetails("The process is stopped.");
        setRemainingTime('00:00');
        handleStopTime();
      };
      window.engine.onProcessStop(onStop);
      isProcessStopListenerRegistered.current = true;
    }

    // Cleanup: remove handler if possible
    return () => {
      // Note: offProcessStart and offProcessStop methods don't exist on window.engine
      // Event listeners will remain active until component unmounts
      // This is consistent with other parts of the codebase
      stopTimer(); // Also clean up timer on unmount
    };
    // Empty deps: only once on mount/unmount
    // eslint-disable-next-line
  }, []);

  return (
    <Paper
      sx={{
        overflow: "hidden",
        width: isExpand ? 250 : 0,
        height: isExpand ? 180 : 0,
        minWidth: isExpand ? 250 : 0,
        pt: isExpand ? 1.5 : 0,
        pb: 0,
        transition: "width 1s,height 1s, min-width 1s",
      }}
      className="space-y-1 flex flex-col relative"
    >
      <Typography
        sx={{
          width: '100%',
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: '5px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#a8a8a8',
            borderRadius: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#eeeeee',
          },
        }}
        className="flex-grow px-2 py-1"
      >
        {isExpand && (
          <ClearIcon
            sx={{
              position: "absolute",
              right: 2,
              top: 2,
              color: "gray",
              cursor: "pointer",
              fontSize: 18,
            }}
            onClick={() => setIsExpand(false)}
          />
        )}
        {isExpand && isDataToRun && (
          <Typography
            sx={{
              display: "flex",
              color: "#9b51e0",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              fontWeight: 400,
              whiteSpace: "nowrap",
              mt: 1
            }}
          >
            <span>{dataToRunText}</span>
            <span>{dataToExtract}</span>
          </Typography>
        )}
        {isExpand && isSuccess && (
          <Typography
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              fontWeight: 400,
              color: "green",
            }}
          >
            <span className="flex text-[green]">
              <img src="./Success.svg" alt="Success" className="w-4 mr-[1px]" />
              {successText}
            </span>
            <span>{successCount}</span>
          </Typography>
        )}
        {isExpand && isFaild && (
          <Typography
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              fontWeight: 400,
              color: "red",
            }}
          >
            <span className="flex text-[red]">
              <img src="./Failed.svg" alt="Success" className="w-3 mx-[2px]" />
              Failed
            </span>
            <span>{failedCount}</span>
          </Typography>
        )}
        {/* {isExpand && remainingTime != 0 && (
          <Typography
            sx={{
              paddingY: 0,
              color: "#9b51e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <span className="flex text-[red]">
              Time Left
            </span>
            <span>{remainingTime}</span>
          </Typography>
        )} */}
        {isExpand && seconds !== 0 && (
          <Typography
            sx={{
              paddingY: 0,
              color: "#9b51e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <span className="flex text-[red]">
              Time Spent
            </span>
            <span className="flex">
              {String(Math.floor(seconds / 3600)).padStart(2, "0")} :{" "}
              {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")} :{" "}
              {String(seconds % 60).padStart(2, "0")}
            </span>
          </Typography>
        )}
        {isExpand && (
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 500,
              textTransform: "capitalize",
              textAlign: "center",
            }}
          >
            {title}
          </Typography>
        )}
        {isExpand && (
          <Typography
            sx={{
              fontSize: 12,
              textTransform: "capitalize",
              textAlign: "center",
              pb: 0.5,
              overflow: 'auto'
            }}
          >
            <span>
              {details}
            </span>
          </Typography>
        )}
      </Typography>
    </Paper>
  );
};

export default TimerSection;
