import { Browser, Page } from "puppeteer-core";
import {LocalCom} from './com';
import puppeteer from "puppeteer-extra";
import { getAnyEdgeStable } from "./edge-path";
import { dirExists, fileExists, fileReadOK, isEmpty, sleep } from "./common";
import { IInitData } from "./types";
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import axios from "axios";
import { DataManager, DataManagerError, MemoryDataManager } from "./DataManager";
import { writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawn } from "child_process";

export const appConfig={
    urls:{
        loginPage:'https://www.centuryvms.com',
        base:'https://www.centuryvms.com',
    },
    selectors:{
        login:{
            // loginSuccess:"#root > div > header > div > button"
            userName:"#username",
            password:"#password",
            loginButton:'#btnLogin',
        }
    },
    timeouts:{
        loginTimeout:300_000,
        default:300_000
    },
    messages:{
        login:{
            Success:'Login Successful.',
            Timeout:'Took too long to login.',
            Unexpected:'Unexpected Error during Login.'
        },
        dataExtraction:{
            Success:"Data extraction Finished."
        }

    },
    samplingRate:1000
} as const;



export class AppCreator{
    initData:IInitData=undefined as any as IInitData;
    LocalCom:LocalCom=undefined as any as LocalCom;
    Browser:Browser=undefined as any as Browser;
    Page:Page=undefined as any as Page;
    pId:string =undefined as any as string
    verified:boolean=false
    century_bearer_token?:string
    dateManager: DataManager | MemoryDataManager = undefined as any as DataManager;
    supplierIds:string[]=[]
    async initiate(pId:string){
        console.log('Initiate')
        try {
            this.pId=pId
            this.LocalCom=new LocalCom(this.pId);
            
            this.initData=await this.LocalCom.getInitData();
          











           
            if (this.initData) {
                const isPullStatus = this.initData.mode === 'pull_status';
                if (!isPullStatus) {
                    const hasSelectedBookings = (
                        (Array.isArray(this.initData.bookings) && this.initData.bookings.length > 0) ||
                        (Array.isArray(this.initData.bookingNumbers) && this.initData.bookingNumbers.length > 0)
                    );

                    if (this.initData.mode === 'download_selected' || hasSelectedBookings) {
                        const bookingList = this.initData.bookings || this.initData.bookingNumbers || [];
                        if (bookingList.length === 0) {
                            this.LocalCom.progress.setTitleAndMessage('Error', "No bookings selected for download.");
                            await this.LocalCom.sendData(undefined, [
                                {
                                    channel: "d",
                                    type: "e",
                                    title: "Error",
                                    message: "No bookings were selected for download. Please select at least one booking in the table."
                                }
                            ]);
                            return;
                        }
                        this.dateManager = new MemoryDataManager(bookingList, this.initData.settings?.companyCode);
                        await this.dateManager.init();
                    } else if (fileExists(this.initData.excelFile)) {
                        if (!fileReadOK(this.initData.excelFile)) {
                            this.LocalCom.progress.setTitleAndMessage('Error', "Access blocked by Windows or Other app.");
                            await this.LocalCom.sendData(undefined, [
                                {
                                    channel: "d",
                                    type: "e",
                                    title: "Error",
                                    message: "Provided Excel is being blocked form access (Reading) by Windows or Other app."
                                }
                            ]);
                            return;
                        }
                        try {
                            this.dateManager = new DataManager(this.initData.excelFile);
                            await this.dateManager.init();
                        } catch (error) {
                            console.error('[App] Excel parse error:', error);
                            const message = error instanceof DataManagerError
                                ? error.message
                                : "Invalid excel format. Use the format provided by UIC.";
                            this.LocalCom.progress.setTitleAndMessage('Error', message);
                            await this.LocalCom.sendData(undefined, [
                                {
                                    channel: "d",
                                    type: "e",
                                    title: "Error",
                                    message
                                }
                            ]);
                            return;
                        }
                        if (this.dateManager.length === 0) {
                            const message = "No booking numbers were found in the Excel file's 'Booking Number' column.";
                            this.LocalCom.progress.setTitleAndMessage('Error', message);
                            await this.LocalCom.sendData(undefined, [
                                { channel: "d", type: "e", title: "Error", message }
                            ]);
                            return;
                        }
                        if (this.dateManager.skippedRows > 0) {
                            await this.LocalCom.sendData(undefined, [
                                {
                                    channel: "d",
                                    type: "w",
                                    title: "Rows Skipped",
                                    message: `${this.dateManager.skippedRows} Excel row(s) have no Booking Number and were skipped.`
                                }
                            ]);
                        }
                    } else {
                        this.LocalCom.progress.setTitleAndMessage('Error', "Invalid Excel Path or No Bookings.");
                        await this.LocalCom.sendData(undefined, [
                            {
                                channel: "d",
                                type: "e",
                                title: "Error",
                                message: "Neither a valid Excel file nor selected bookings were provided."
                            }
                        ]);
                        return;
                    }
                }
              
                
            if(isEmpty(this.initData.userName)){
                this.LocalCom.progress.setTitleAndMessage('Error',"Username is Required.")
                await this.LocalCom.sendData(undefined,[
                    {
                        channel: "d",
                        type: "e",
                        title: "Error",
                        message: "Username is Required."
                    }
                ])
                return
            }
            if(isEmpty(this.initData.password)){
                this.LocalCom.progress.setTitleAndMessage('Error',"Password is Required.")
                await this.LocalCom.sendData(undefined,[
                    {
                        channel: "d",
                        type: "e",
                        title: "Error",
                        message: "Password is Required."
                    }
                ])
                return
            }
                
            }else{
                this.LocalCom.progress.setTitleAndMessage('Error',"Invalid action.")
                await this.LocalCom.sendData(undefined,[
                    {
                        channel: "d",
                        type: "e",
                        title: "Error",
                        message: "Invalid action."
                    }
                ])
                return
            }
            this.verified=true;
            console.log('xxx-2')
            return this
        } catch (error) {
            console.log(error)
            console.log("error")
            this.LocalCom.progress.setTitleAndMessage('Failed',"Failed to initiate app.")
            await this.LocalCom.sendData(undefined,[
                {
                    channel: "d",
                    type: "e",
                    title: "Error",
                    message: "Failed to initiate app."
                }
            ])
            this.verified=false
        }
    }


    async  launchBrowser(maxRetries = 5) {
        let port = 9000+Math.floor(Math.random()*999); // starting port
        let browser:Browser, page:Page;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            port = 9000+Math.floor(Math.random()*999);
            try {
            // Spawn Edge with a unique debugging port
                const chromeArgs = [
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    "--start-maximized",
                    "--disable-infobars",
                    `--remote-debugging-port=${port}`,
                    `--user-data-dir=${join(homedir(), "AppData", "Local", "Temp", `puppeteer-edge-${Date.now()}`)}`,
                    "--disable-features=msEdgeSync",
                    "--disable-features=msEdgeSigninDialog",
                    "--disable-features=EdgeFirstRunExperience",
                    "--incognito"
                ];

                const edgeProc = spawn(getAnyEdgeStable(), chromeArgs, {
                    detached: false,
                    stdio: "ignore"
                });

                // Give Edge time to start listening
                await new Promise(res => setTimeout(res, 4000));

                // Attach Puppeteer to the spawned Edge
                browser = await puppeteer.connect({
                    browserURL: `http://localhost:${port}`
                });

                // Grab the existing page opened by Edge or create one
                const pages = await browser.pages();
                page = pages.length > 0 ? pages[0] : await browser.newPage();
                await page.setViewport({ width: 1366, height: 768 });

                console.log(`Connected to Edge on port ${port}`);
                this.Browser=browser
                this.Page=page
                return
            } catch (err) {
            console.error(`Attempt ${attempt + 1} failed on port ${port}:`, err);
            port++; // increment port for next retry
            await new Promise(res => setTimeout(res, 5000));
            }
        }

        throw new Error("Failed to launch Edge after retries");
    }

    async createSession(){
        const session= axios.create({
            baseURL:"https://apidr.centuryvms.com/api"
        })
        const apiKey=await this.Page.evaluate(()=>{
            // Loop through all keys in sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);

                // Check if the key starts with "user:"
                if (key && key.includes("user:")) {
                try {
                    // Parse the stored JSON string
                    // @ts-ignore

                    const data = JSON.parse(sessionStorage.getItem(key));

                    // Return the access_token if present
                    if (data && data.access_token) {
                    return data.access_token;
                    }
                } catch (err) {
                    console.error("Error parsing sessionStorage value:", err);
                }
                }
            }
            return null; // No API key found
        });
        if (apiKey) {
            this.century_bearer_token = apiKey;
        }
        session.interceptors.request.use((conf) => {
            // @ts-ignore
            conf.headers = {
                ...conf.headers,
                Authorization: `Bearer ${apiKey}`,
                };
            return conf;
        });
        return session
    }

    /**
     * Opens a Century VMS page and waits until the portal's access token is in
     * sessionStorage (needed by createSession). Reloads once if it does not appear.
     * Replaces fixed sleeps; returns false if the token never showed up.
     */
    async openPortalPage(url: string, timeoutMs: number = 45_000): Promise<boolean> {
        try {
            await this.Page.goto(url, { waitUntil: 'load', timeout: 60_000 });
        } catch (err) {
            console.warn(`[openPortalPage] Navigation warning for ${url}:`, err);
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            const ready = await this.Page.waitForFunction(() => {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.includes("user:")) {
                        try {
                            const data = JSON.parse(sessionStorage.getItem(key) || 'null');
                            if (data && data.access_token) return true;
                        } catch { /* ignore */ }
                    }
                }
                return false;
            }, { timeout: timeoutMs, polling: 1000 }).then(() => true).catch(() => false);
            if (ready) {
                // Let the SPA finish its first render before automation continues.
                await sleep(3_000);
                return true;
            }
            console.log(`[openPortalPage] Access token not found yet, reloading (attempt ${attempt + 1})...`);
            try {
                await this.Page.reload({ waitUntil: 'load', timeout: 60_000 });
            } catch (err) {
                console.warn('[openPortalPage] Reload warning:', err);
            }
        }
        return false;
    }

    /** Closes the browser if it was opened; never throws and never hangs longer than 10s. */
    async closeBrowser(): Promise<void> {
        if (!this.Browser) return;
        try {
            await Promise.race([
                this.Browser.close(),
                new Promise(res => setTimeout(res, 10_000)),
            ]);
        } catch (err) {
            console.warn('[closeBrowser] Error closing browser:', err);
        }
    }
}


