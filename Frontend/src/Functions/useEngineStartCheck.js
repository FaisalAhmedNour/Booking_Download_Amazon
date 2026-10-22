import {
    useState,
} from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const useEngineStartCheck = () => {

    const [timePassed, setTimePassed] = useState(0)

    const getCookie = () => {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [cookieName, cookieValue] = cookie.split('=');
            if (cookieName === "auth_token") {
                return cookieValue;
            }
        }
        return null;
    }

    const isEngineExists = async () => {
        const token = await getCookie();
        try {
            const result = await axios({
                validateStatus: function (status) {
                    return status < 500;
                },
                method: 'post',
                url: 'http://localhost:4115/api/init',
                data: { token: token },
            });

            if (!result?.data?.logedin) {
                const url = 'uicomr://' + token;
                window.location.href = url;
                connectEngine()
            }
        } catch (error) {
            console.error('API Error:', error);
            const url = 'uicomr://' + token;
            window.location.href = url;
            connectEngine()
        }
    };

    const showStartEngineDialog = () => {
        // console.log('showing engine not present');
        Swal.fire({
            title: 'Engine not found!',
            text: 'You have to download the engine first to use some of our services.',
            icon: 'info',
            // showDenyButton: true,
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            // denyButtonColor: '#0cc243',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Download Engine',
            // denyButtonText: `Download Engine`
        }).then((result) => {
            if (result.isConfirmed) {
                const url = 'https://github.com/utsteck/Engine/releases/download/1.0.17/UICengine-Setup-1.0.17.exe';
                window.location.href = url;
                Swal.fire({
                    title: 'Download will start in a few seconds!',
                    text: 'Install the engine after finishing download and reload the page after installing it.',
                    icon: 'info',
                })
            }
        });
    };

    const connectEngine = async () => {
        // console.log('not running');
        const token = await getCookie()
        await axios({
            validateStatus: function (status) {
                return status < 500;
            },
            method: 'post',
            url: 'http://localhost:4115/api/init',
            data: { token: token },
        })
            .then(result => {
                console.log(result);
                if (!result?.data?.logedin) {
                    if (timePassed < 30) {
                        setTimeout(() => {
                            connectEngine();
                          }, 1000);
                        setTimePassed(timePassed + 1)
                    } else {
                        console.log('yes1')
                        showStartEngineDialog()
                    }
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                if (timePassed < 30) {
                    setTimeout(connectEngine, 1000);
                    setTimePassed((timePassed) => timePassed + 1)
                }
                else {
                    console.log('yes2')
                    showStartEngineDialog()
                }
            })
    };


    return {
        isEngineExists,
    };
};

export default useEngineStartCheck;

