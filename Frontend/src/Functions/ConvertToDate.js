const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const convertDateFormate = (date) => {
    const formatDate = new Date(date);
    return `${formatDate.getDate() > 9 ? formatDate.getDate() : `0${formatDate.getDate()}`}-${month[formatDate.getMonth()]}-${formatDate.getFullYear()}`;
} 

export default convertDateFormate;