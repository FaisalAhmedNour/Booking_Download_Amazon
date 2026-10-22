import { TimeoutError } from "puppeteer-core";
import { appConfig, AppCreator } from "../utils/App";
import { sleep } from "../utils/common";

async function fillAndSubmitCredentials(page:AppCreator['Page'],userName:string,password:string) {
     // Get the iframe element handle
    await page.waitForSelector("iframe",{timeout:appConfig.timeouts.loginTimeout})
    
     const elementHandle = await page.$('iframe');
    if(elementHandle==null) return;
  // Get the iframe's content frame
    const frame = await elementHandle.contentFrame();

    console.log(11)
    await frame.waitForSelector(appConfig.selectors.login.userName,{timeout:appConfig.timeouts.loginTimeout})
    console.log(12)
    const userNameField=await  frame.$(appConfig.selectors.login.userName)
    if(userNameField==null) return;
    await userNameField.type(userName)  

    const passwordField=await  frame.$(appConfig.selectors.login.password)
    if(passwordField==null) return;
    await passwordField.type(password);
    await frame.waitForSelector(appConfig.selectors.login.loginButton,{timeout:appConfig.timeouts.loginTimeout,visible:true})
    const loginButton2=await frame.$(appConfig.selectors.login.loginButton);
    if(loginButton2==null) return;
    await  loginButton2.click()
}


export async function login(app:Readonly<AppCreator>) {
    try {
        let  waitfor=appConfig.timeouts.loginTimeout;
        console.log(1)
        try{
            await app.Page.goto(appConfig.urls.loginPage,{timeout:appConfig.timeouts.loginTimeout});
        }
        catch(err){
            await app.Page.goto(appConfig.urls.loginPage,{timeout:appConfig.timeouts.loginTimeout});
        }
        console.log(2)
        
        console.log(3)
        console.log('initData',app.initData)
        await sleep(3000);
        await fillAndSubmitCredentials(app.Page,app.initData.userName,app.initData.password)
        console.log(4)
        
        while(waitfor>0){
            try {
                await app.Page.waitForSelector('#userIdAndSubgroup2',{timeout:appConfig.samplingRate});
                return {success:true,message:appConfig.messages.login.Success}
            } catch {}
            // await sleep(appConfig.samplingRate);
            waitfor=waitfor-appConfig.samplingRate;
        }
        return {success:false,message:appConfig.messages.login.Timeout}
    } catch (error) {
        if(error instanceof TimeoutError){
            return {success:false,message:appConfig.messages.login.Timeout}
        }
        else{
            console.log("errLoc: functions\\login.ts: 15",error)
            return {success:false,message:appConfig.messages.login.Unexpected};
        }
    }
}