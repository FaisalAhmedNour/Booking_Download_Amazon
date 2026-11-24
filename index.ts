import { AppCreator } from './utils/App';
import { login } from './functions/login';
import issueBooking  from './functions/issueBooking';
import pullBookingStatus from './functions/pullBookingStatus';


async function run(app: AppCreator) {
    app.LocalCom.progress.setTitleAndMessage("Opening Edge.",'Trying to open Edge Browser.')
    await app.LocalCom.sendData();

    await app.launchBrowser()
    console.log("Trying to Login..")

    app.LocalCom.progress.setTitleAndMessage("Logging in.",'Trying to log in to the portal.')
    await app.LocalCom.sendData();

    const loginStatus=await login(app);
    console.log('loginStatus',loginStatus)
    if(!loginStatus.success){
        app.LocalCom.progress.setTitleAndMessage("Login Failed.",'')
        await app.LocalCom.sendData(undefined,[
            {
                channel: app.LocalCom.progress.channel,
                type: 'e',
                title: 'Login Failed',
                message: loginStatus.message
            }
        ])
        return;
    }

    app.LocalCom.progress.setTitleAndMessage("Logged-in.",'Login Success.')
    await app.LocalCom.sendData();

    if (app.initData?.mode === 'pull_status') {
        await pullBookingStatus(app);
    } else {
        await issueBooking(app);
    }
}

async function entry(){
    const App=new AppCreator();
    try {
        const app = await App.initiate('6acb996ef34bc7c0f8cc1d81');
        if(app!=null && app.verified===true){
            await run(app);
        }
    } catch (e) {
        console.log(e);
        try {
            App.LocalCom?.progress?.setTitleAndMessage('Failed', 'Unexpected error.');
            await App.LocalCom?.sendData(undefined, [{
                channel: App.LocalCom.progress.channel,
                type: 'e',
                title: 'Unexpected Error',
                message: e instanceof Error ? e.message : String(e)
            }]);
        } catch { /* engine unreachable; nothing more to report */ }
    } finally {
        // Always close Edge, on success, login failure or error.
        await App.closeBrowser();
        process.exit();
    }
}

entry()
process.on('uncaughtException', function (err) {
    console.log(err);
});
