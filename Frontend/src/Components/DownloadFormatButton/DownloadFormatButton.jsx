import { useContext } from "react";
import Button from "@mui/material/Button";
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
// import { AuthContext } from "../../pages/Providers/AuthProvider";
// import { getUpdatedInfo, UpdateUserMeta } from "../../Services/AuthService";

const DownloadFormatButton = ({ link }) => {
    // const AuthContextData = useContext(AuthContext);

    // const handleGetFileSize = async (event) => {
    //     event.preventDefault(); // Prevent the default link behavior

    //     try {
    //         const response = await fetch(link, { method: 'HEAD' });

    //         if (response.ok) {
    //             const contentLength = response.headers.get('Content-Length');
    //             const sizeInBytes = parseInt(contentLength, 10);

    //             const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    //             const k = 1024;
    //             const i = Math.floor(Math.log(sizeInBytes) / Math.log(k)); // Determine the unit index
    //             const sizeWithName = parseFloat(sizeInBytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
    //             handleUpdate(sizeWithName);

    //             window.location.href = link;
    //         } else {
    //             console.error('Failed to fetch file headers');
    //         }
    //     } catch (error) {
    //         console.error('Error fetching file:', error);
    //     }
    // };

    // const handleUpdate = async (fileSize) => {
    //     try {
    //         let list = [];
    //         const result = await getUpdatedInfo('Downloads');
    //         // console.log(result);
    //         if (result?.status === 200 && result?.data?.metaData) {
    //             list = result?.data?.metaData;
    //         }
    //         else {
    //             list = [];
    //         }
    //         const k = await UpdateUserMeta(
    //             'Downloads',
    //             {
    //                 metaData: [
    //                     {
    //                         name: link,
    //                         time: new Date(),
    //                         size: fileSize
    //                     },
    //                     ...list.slice(0, 9)
    //                 ]
    //             }
    //         );
    //         // AuthContextData?.setReloadDownloads(prev => !prev)
    //         console.log(k);
    //     }
    //     catch (error) {
    //         console.log(error);
    //     }
    // }

    return (
        // <a href={link} >
        <Button
            // onClick={handleGetFileSize}
            href={link}
            component="label"
            variant="contained"
            startIcon={<CloudDownloadIcon />}
            sx={{
                bgcolor: '#4d44b5'
            }}
        >
            Download Format
        </Button>
        // </a>
    );
};

export default DownloadFormatButton;
