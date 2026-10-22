import axios from 'axios';

const useGetPath = () => {

    const handleGetFolderPath = async () => {
        try {
            const response = await axios({
                method: 'post',
                url: 'http://localhost:4115/api/fs/get-path',
                data: {
                    "title": "Select directories",
                    "type": "dir"
                },
            });

            console.log(response);
            if (response?.statusText === 'OK') {
                return response?.data
                // setFolderPath()
                // console.log('object', response?.data?.filePaths);
            }
        } catch (error) {
            console.error('API Error:', error);
        }
    }

    const handleGetFilePath = async (isMulti = true) => {
        try {
            const response = await axios({
                method: 'post',
                url: 'http://localhost:4115/api/fs/get-path',
                data: {
                    title: "Select Excel Files",
                    type: "file",
                    multifile: isMulti,
                    filters: [
                        { name: "Excel", extensions: ["xlsx", "csv"] },
                        { name: "All Files", extensions: ["*"] }
                    ]
                },
            });
            // console.log(respo    nse?.data);
            return response?.data
        } catch (error) {
            console.error('API Error:', error);
        }
    }

    return {
        handleGetFilePath,
        handleGetFolderPath
    }
};

export default useGetPath;