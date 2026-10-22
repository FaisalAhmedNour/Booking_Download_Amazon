import { useRef, useState, useContext } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { getUpdatedVersion } from "../Services/AuthService";
import { AuthContext } from "../pages/Providers/AuthProvider";

const useEngineService = () => {
  const process = useRef();
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const { getCookie } = useContext(AuthContext);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(true);
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloadStatus, setDownloadStatus] = useState({
    speed: 0,
    downloaded: 0,
    percentage: 0,
  });

  const isEngineRunning = async (prs) => {
    process.processId = prs;
    // console.log('process1', prs);
    const token = await getCookie();
    try {
      const result = await axios({
        validateStatus: function (status) {
          return status < 500;
        },
        method: "post",
        url: "http://localhost:4115/api/init",
        data: { token: token },
      });
      // console.log("is Engine running: ", result);
      if (result?.data?.logedin) {
        // console.log('engine present');
        processCheck();
      } else {
        // console.log('engine not present1');
        showStartEngineDialog(token);
      }
    } catch (error) {
      // console.log('engine not present2');
      // console.error("API Error:", error);
      showStartEngineDialog(token);
    }
  };

  const showStartEngineDialog = (token) => {
    console.log("showing engine not present");
    setIsUpdating(false);
    Swal.fire({
      title: "Engine not found!",
      text: "You have to download the engine first. If you already have than you have to start it.",
      icon: "info",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      denyButtonColor: "#0cc243",
      cancelButtonColor: "#d33",
      confirmButtonText: "Start Engine",
      denyButtonText: `Download Engine`,
    }).then((result) => {
      if (result.isConfirmed) {
        const url = "uicomr://" + token;
        window.location.href = url;
        connectEngine();
      } else if (result.isDenied) {
        const url =
          "https://github.com/utsteck/Engine/releases/download/1.0.6/UICengine-Setup-1.0.6.exe";
        window.location.href = url;
        Swal.fire({
          title: "Download will start in a few seconds!",
          text: "Install the engine after finishing download and reload the page after installing it.",
          icon: "info",
        });
      }
    });
  };

  const connectEngine = async () => {
    const token = await getCookie();
    await axios({
      validateStatus: function (status) {
        return status < 500;
      },
      method: "post",
      url: "http://localhost:4115/api/init",
      data: { token: token },
    })
      .then((result) => {
        // console.log(result);
        processCheck();
      })
      .catch((error) => {
        // console.error("API Error:", error);
        setTimeout(connectEngine, 1000);
      });
  };

  const updatedVersion = async (presentVersion) => {
    try {
      const result = await getUpdatedVersion(process.processId);
      const currentVersion = result?.data?.versions?.latest;
      // console.log("current ", version, 'update ', currentVersion,);
      if (presentVersion === currentVersion) {
        // console.log("version already updated");
        setIsUpdating(false);
      } else {
        setIsUpdating(true);
        handleDownloadProcess();
        setUpdateVersion(currentVersion);
        // console.log('version need to update');
      }
    } catch (error) {
      // console.error(error);
    }
  };

  const processCheck = async () => {
    try {
      fetch("http://localhost:4115/api/processInfo/" + process.processId)
        .then((res) => res.json())
        .then((data) => {
          // console.log('version', data)
          if (data?.code) {
            handleDownloadProcess();
            // console.log('process not present1');
          } else {
            updatedVersion(data?.version);
            setVersion(data?.version);
            // console.log('process present');
            // const updatedVersion = updatedVersion();
          }
        });
    } catch (error) {
      // console.error(error);
      // console.log('process not present2');
    }
  };

  const handleDownloadProcess = async () => {
    // console.log('download process');
    await axios({
      validateStatus: function (status) {
        return status < 500;
      },
      method: "post",
      url: "http://localhost:4115/api/process/install",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        pid: process.processId,
        overwrite: true,
      },
    })
      .then((result) => {
        // console.log(result);
        getProgress();
      })
      .catch((error) => {
        // console.error("API Error:", error);
      });
  };

  const getProgress = () => {
    // console.log('process downloading');
    // console.log('process5', process.processId);
    const webs = new WebSocket(
      "ws://localhost:4115/update/" + process.processId
    );
    webs.addEventListener("open", (event) => {
      // console.log(event);
    });
    webs.addEventListener("message", (event) => {
      try {
        const status = JSON.parse(event.data);
        // console.log("status message  ", status);

        if (status?.message) {
          if (status?.message === "Download Done. Installing") {
            // setIsVisible(false)
            setMessage("Installing...");
            // console.log("engine: ", status?.message, status?.message === 'Download Done. Installing');
          } else if (status?.message === "Installation Done.") {
            setIsVisible(false);
            setMessage("Successfully Installed.");
            setVersion(updateVersion);
            processCheck();
            setIsUpdating(false);
          } else {
            // console.log(status?.message);
          }
        } else {
          setIsVisible(true);
          const { speed, bytes, percentage } = status;
          setDownloadStatus({
            speed: speed,
            downloaded: bytes,
            percentage: percentage,
          });
          setProgress(percentage);
          setMessage("Downloading...");
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });
    return () => {
      webs.close();
    };
  };

  return {
    version,
    message,
    progress,
    isVisible,
    isUpdating,
    downloadStatus,
    isEngineRunning,
  };
};

export default useEngineService;
