import { AppCreator } from './utils/App';
import { login } from './functions/login';
import issueBooking  from './functions/issueBooking';
import pullBookingStatus from './functions/pullBookingStatus';
import { sleep } from './utils/common';


function entry(){
    const App=new AppCreator();
    App.initiate('6ac7964cf34bc7c0f89bf56a').then(async(app)=>{
        if(app!=null && app.verified===true){
            app.LocalCom.progress.setTitleAndMessage("Opening Edge.",'Trying to open Edge Browser.')
            app.LocalCom.sendData();

            await app.launchBrowser()
            console.log("Trying to Login..")

            app.LocalCom.progress.setTitleAndMessage("Logging in.",'Trying to log in to the portal.')
            app.LocalCom.sendData();

            
            const loginStatus=await login(app);
            // const loginStatus={ success: true, message: 'Login Successful.' };
            console.log('loginStatus',loginStatus)
            if(loginStatus.success){
                app.LocalCom.progress.setTitleAndMessage("Logged-in.",'Login Success.')
                app.LocalCom.sendData();
                
                if (app.initData?.mode === 'pull_status') {
                    await pullBookingStatus(app);
                } else {
                    await issueBooking(app);
                }

                await app.Browser.close();
                process.exit();
            }else{
                app.LocalCom.progress.setTitleAndMessage("Login Failed.",'')
                app.LocalCom.sendData(undefined,[
                    {
                        channel: app.LocalCom.progress.channel,
                        type: 'e',
                        title: 'Login Failed',
                        message: loginStatus.message
                    }
                ])
            }
            process.exit()
            // console.log(app)
            
        }
    }).catch(e=>{
        console.log(e)
        process.exit()
    }

    )
    
}

entry()
process.on('uncaughtException', function (err) {
    console.log(err);
}); 
