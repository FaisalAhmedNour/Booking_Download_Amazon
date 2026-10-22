export const convertToISODate = (date, splitAt = "/") => {
    // console.log(date)
    try {
        const parsedDate = new Date(
            date + ' GMT+6'
        );
        console.log(parsedDate.toISOString());
        return parsedDate.toISOString();
    } catch (e) {
        console.log("Error:", e.message);
        return "";
    }
};

