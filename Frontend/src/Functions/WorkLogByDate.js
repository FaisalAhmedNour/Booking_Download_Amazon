import { getWorkLog } from "../Services/AuthService";

const WorkLogByDate = () => {
  const workLog = async (from, to) => {
    try {
      const result = await getWorkLog(from, to);
      // console.log(from, to, result);
      if (result?.statusText === "OK") {
        return { success: true, data: result?.data };
      } else {
        console.log(result);
        return { success: false, message: result?.data?.message };
      }
    } catch (error) {
      console.error(error);
      setWorkLogError(error?.message);
      return { success: false, message: error?.response?.data?.message };
    }
  };

  return {
    workLog,
  };
};

export default WorkLogByDate;
