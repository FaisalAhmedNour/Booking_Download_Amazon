import axios from "axios";
import NoSleep from "nosleep.js";
import { useRef, useState } from "react";
import { useParams } from "react-router-dom";

const useEngineStart = () => {
  var noSleep = new NoSleep();
  const websRef = useRef(null);
  const { process } = useParams();
  const [seconds, setSeconds] = useState(0);
  // const [reload, setReload] = useState(false)
  const [sockedState, setSockedState] = useState(0);
  const [engineError, setEngineError] = useState("");
  // const { workLogsReload, setWorkLogsReload } = useContext(AuthContext);
  const [engineStatus, setEngineStatus] = useState("");
  const [receivedData, setReceivedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const timeout = useRef(null);
  const startTimer = () => {
    timeout.id = setTimeout(() => {
      setSeconds((prevSeconds) => prevSeconds + 1);
      startTimer();
    }, 1000);
  };

  const stopTimer = () => {
    clearTimeout(timeout.id);
  };

  const handleStartTime = () => {
    setSeconds(0);
    startTimer();
  };

  const handleStopTime = () => {
    stopTimer();
  };

  const startEngine = (data) => {
    console.log(data);
    try {
      axios({
        method: "post",
        url: "http://localhost:4115/api/process/stop",
        data: {
          pid: process || "6578e4ecf0464d7fb253de58",
        },
      })
        .then((result) => {
          console.log(result);
          noSleep.disable();
          setIsProcessing(false);
          setEngineStatus("stopped");
          handleStopTime();
          socked();
        })
        .catch((error) => {
          console.error("API Error:", error);
        });
    } catch (error) {
      console.log(error);
    } finally {
      axios({
        method: "post",
        url: "http://localhost:4115/api/process/start",
        data: data,
      })
        .then((result) => {
          if (result?.data?.status === "started") {
            socked();
            noSleep.enable();
            handleStartTime();
            setReceivedData([]);
            setIsProcessing(true);
            setEngineStatus("Started");
          } else {
            console.log(result);
            setEngineError(result?.data?.message);
            setEngineStatus("Failed");
            setIsProcessing(false);
          }
        })
        .catch((error) => {
          console.error("API Error:", error);
          setEngineStatus("failed");
          setIsProcessing(false);
          if (error?.message === "Network Error") {
            setEngineError(
              "Please make sure your UICEngine is running! and you are connected to internet."
            );
          } else {
            setEngineError(error?.response?.data?.message);
          }
        });
    }
  };

  const socked = () => {
    // console.log('soket called');
    if (websRef.current) {
      websRef.current.close();
    }

    const newWebs = new WebSocket(
      `ws://localhost:4115/processdata/${
        process ? process : "6578e4ecf0464d7fb253de58"
      }`
    );
    setSockedState(newWebs?.readyState);
    websRef.current = newWebs;

    newWebs.addEventListener("open", (event) => {
      console.log(event);
    });
    newWebs.addEventListener("message", (event) => {
      try {
        const status = JSON.parse(event.data);
        console.log(JSON.parse(event.data), !status?.message);
        // setRender(!render)
        if (status?.status === "Start") {
          setEngineStatus("Started");
        } else if (status?.status === "Running") {
          if (status?.data) {
            setReceivedData((receivedData) => [...receivedData, status?.data]);
          }
          setEngineStatus("running");
          // setWorkLogsReload(!workLogsReload);
        } else {
          // console.log('yes stop')
          // setWorkLogsReload(!workLogsReload);
          handleStop();
          handleStopTime();
          if (websRef.current) {
            websRef.current.close();
          }
          stopTimer();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        handleStopTime();
        handleStop();
        stopTimer();
        if (websRef.current) {
          websRef.current.close();
        }
        setEngineError(error?.response?.data?.message);
      }
    });
    return () => {
      if (websRef.current) {
        websRef.current.close();
      }
      stopTimer();
    };
  };

  const handleStop = () => {
    axios({
      method: "post",
      url: "http://localhost:4115/api/process/stop",
      data: {
        pid: process || "6578e4ecf0464d7fb253de58",
      },
    })
      .then((result) => {
        console.log(result);
        noSleep.disable();
        setIsProcessing(false);
        setEngineStatus("Stopped");
        handleStopTime();
        // soket()
      })
      .catch((error) => {
        console.error("API Error:", error);
      });
  };

  return {
    seconds,
    handleStop,
    startEngine,
    engineError,
    receivedData,
    engineStatus,
    isProcessing,
  };
};

export default useEngineStart;
