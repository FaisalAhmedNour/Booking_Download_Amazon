import { AppCreator } from './utils/App';
import { login } from './functions/login';
import issueBooking from './functions/issueBooking';
import pullBookingStatus from './functions/pullBookingStatus';
import comparePoItemsApi from './functions/comparePoItemsApi';
import { DataManager, MemoryDataManager } from './utils/DataManager';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';

// Load config from EngineTestConfig.json or fallback
let config: any = {};
const configPath = path.join(__dirname, 'EngineTestConfig.json');
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.warn('⚠️ Could not parse EngineTestConfig.json, using defaults.');
    }
}

async function runLocalTest() {
    const isPullStatus = process.argv.includes('--pull-status') || config.initData?.mode === 'pull_status';
    const bookingsArg = process.argv.find(arg => arg.startsWith('--bookings='));
    // Compares PO items from the grid export with the SearchBookingItem API (uses --bookings= or the config's bookings).
    const isCompareApi = process.argv.includes('--compare-api');
    const isDownloadSelected = isCompareApi || process.argv.includes('--download-selected') || Boolean(bookingsArg) || config.initData?.mode === 'download_selected';
    const statusArgMatch = process.argv.find(arg => arg.startsWith('--status='));
    const targetStatus = statusArgMatch ? statusArgMatch.split('=')[1] : (config.initData?.settings?.status || 'Draft');

    console.log('==================================================');
    if (isPullStatus) {
        console.log('🚀 Starting Century VMS Online Booking Status Pull Test');
    } else if (isCompareApi) {
        console.log('🚀 Starting PO Items API vs Export Comparison');
    } else if (isDownloadSelected) {
        console.log('🚀 Starting Century VMS Selected Booking Download Test');
    } else {
        console.log('🚀 Starting Century VMS Excel Booking Download Test');
    }
    console.log('==================================================');

    const app = new AppCreator();

    // 1. Resolve Data Source (Excel file OR Selected Bookings)
    let excelPath = '';
    let selectedBookings: any[] = [];

    if (isDownloadSelected) {
        if (bookingsArg) {
            // PowerShell/npm may split "A,B,C" into separate arguments; take the plain
            // arguments that follow --bookings= as well.
            const argIndex = process.argv.indexOf(bookingsArg);
            const following: string[] = [];
            for (const a of process.argv.slice(argIndex + 1)) {
                if (a.startsWith('--')) break;
                following.push(a);
            }
            const rawKeys = [bookingsArg.split('=')[1] || '', ...following]
                .flatMap(v => v.split(/[,\s]+/))
                .map(k => k.trim())
                .filter(Boolean);
            selectedBookings = rawKeys.map(k => ({ booking_number: k, comp_cd: '589' }));
        } else if (config.initData?.bookings && Array.isArray(config.initData.bookings)) {
            selectedBookings = config.initData.bookings;
        } else if (config.initData?.bookingNumbers && Array.isArray(config.initData.bookingNumbers)) {
            selectedBookings = config.initData.bookingNumbers.map((k: string) => ({ booking_number: String(k).trim(), comp_cd: '589' }));
        } else {
            selectedBookings = [
                { booking_number: '20261012-001', comp_cd: '589' }
            ];
        }
        console.log(`📋 Target Selected Bookings (${selectedBookings.length}):`, selectedBookings.map(b => b.booking_number).join(', '));
    } else if (!isPullStatus) {
        let rawExcelPath = config.initData?.excelFile;
        if (rawExcelPath) {
            excelPath = path.isAbsolute(rawExcelPath) ? rawExcelPath : path.resolve(__dirname, rawExcelPath);
        }
        if (!excelPath || !fs.existsSync(excelPath)) {
            if (rawExcelPath && !fs.existsSync(excelPath)) {
                console.warn(`⚠️ Specified excelFile "${rawExcelPath}" not found. Falling back to devDoc.`);
            }
            excelPath = path.join(__dirname, 'devDoc', 'CENTURY VMS.xlsx');
        }

        if (!fs.existsSync(excelPath)) {
            console.error(`❌ Excel file not found at: ${excelPath}`);
            process.exit(1);
        }
        console.log(`📁 Excel file: ${excelPath}`);
    }

    // 2. Setup Init Data
    app.initData = {
        mode: isPullStatus ? 'pull_status' : isDownloadSelected ? 'download_selected' : 'download_po',
        userName: config.initData?.userName || process.env.CENTURY_VMS_USER || '',
        password: config.initData?.password || process.env.CENTURY_VMS_PASSWORD || '',
        excelFile: excelPath,
        bookings: selectedBookings,
        downloadDir: config.initData?.settings?.downloadDir || config.initData?.downloadDir || (excelPath ? path.dirname(excelPath) : path.join(os.homedir(), 'Downloads')),
        settings: {
            status: targetStatus,
            companyCode: config.initData?.settings?.companyCode || '589 - Amazon Multi Country Consolidation Thailand',
            downloadPoItems: config.initData?.settings?.downloadPoItems !== false,
            combinePoItems: config.initData?.settings?.combinePoItems !== false,
            keepIndividualFiles: config.initData?.settings?.keepIndividualFiles === true,
            downloadPdf: config.initData?.settings?.downloadPdf !== false,
            downloadDir: config.initData?.settings?.downloadDir || config.initData?.downloadDir || (excelPath ? path.dirname(excelPath) : path.join(os.homedir(), 'Downloads'))
        }
    };

    if (!app.initData.userName || !app.initData.password) {
        console.error('❌ Century VMS credentials missing. Set initData.userName/password in EngineTestConfig.json '
            + '(copy EngineTestConfig.example.json) or the CENTURY_VMS_USER / CENTURY_VMS_PASSWORD env vars.');
        process.exit(1);
    }

    console.log(`👤 User: ${app.initData.userName}`);
    if (isPullStatus) {
        console.log(`📊 Mode: Status Pulling (Target Status: "${targetStatus}")`);
    } else if (isDownloadSelected) {
        console.log(`🎯 Mode: Download Selected Bookings (${selectedBookings.length} booking(s))`);
        console.log(`📥 Download PO Items: ${app.initData.settings.downloadPoItems}`);
        console.log(`📄 Download PDF: ${app.initData.settings.downloadPdf}`);
        console.log(`📂 Output Directory: ${app.initData.settings.downloadDir}`);
    } else {
        console.log(`📥 Download PO Items: ${app.initData.settings.downloadPoItems}`);
        console.log(`📄 Download PDF: ${app.initData.settings.downloadPdf}`);
        console.log(`📂 Output Directory: ${app.initData.settings.downloadDir}`);
    }

        let totalStreamedBookings = 0;
        app.LocalCom = {
            CLIargs: {
                devFlag: true,
                token: 'dev',
                info: '',
                dir: '',
                driver: '',
                localRoot: 'http://127.0.0.1:4116'
            },
            progress: {
                channel: 'd',
                setTotal: (total: number) => {
                    console.log(`[PROGRESS] Total items to process: ${total}`);
                },
                getNewSession: (bufferSize: number = 1, applyCharge: boolean = false) => {
                    return Promise.resolve({
                        id: 'local_dev_session',
                        remaining: 999999,
                        name: 'OK',
                        message: 'No charge',
                        doNext: true
                    });
                },
                setTitleAndMessage: (title: string, details: string) => {
                    console.log(`[STATUS] ${title} - ${details || ''}`);
                },
                registerSuccess: (count: number = 1) => {
                    console.log(`[SUCCESS] Processed ${count} item(s)`);
                    return Promise.resolve({ continue: true, message: 'OK' });
                },
                registerFail: (count: number = 1) => {
                    console.log(`[FAIL] Failed ${count} item(s)`);
                    return Promise.resolve({ continue: true, message: 'Fail' });
                },
                flushBuffer: () => {
                    console.log('[PROGRESS] Flushed progress buffer');
                    return Promise.resolve({ continue: true, message: 'OK' });
                },
                getObj: () => ({ channel: 'd' })
            },
            // Stand-in for the engine proxy: calls the UIC backend directly when
            // EngineTestConfig.json has baseUrl + apiKey; otherwise saving is skipped.
            Proxy: (config.baseUrl && config.apiKey) ? (() => {
                const http = axios.create({
                    baseURL: String(config.baseUrl).replace(/\/+$/, ''),
                    headers: { Authorization: `Bearer ${config.apiKey}` },
                    validateStatus: (s: number) => s < 500,
                    timeout: 15000,
                });
                return {
                    get: (url: string) => http.get(url),
                    post: (url: string, data: unknown) => http.post(url, data),
                    patch: (url: string, data: unknown) => http.patch(url, data),
                    delete: (url: string, data: unknown) => http.delete(url, { data }),
                };
            })() : undefined,
            sendData: (tableData: any, messages: any, log: any) => {
                if (messages && messages.length > 0) {
                    for (const m of messages) {
                        console.log(`[MSG] [${m.type?.toUpperCase() || 'INFO'}] ${m.title}: ${m.message}`);
                    }
                }
                if (tableData && tableData.length > 0) {
                    if (tableData[0]?._type === 'status_summary') {
                        console.log('\n📊 [STATUS SUMMARY COUNTS]:');
                        console.table(tableData[0].data);
                        if (tableData[0].token) {
                            console.log(`🔑 Bearer Token Extracted: ${tableData[0].token.substring(0, 35)}...`);
                        }
                    } else if (tableData[0]?.po_item_file !== undefined || tableData[0]?.pdf_file !== undefined || tableData[0]?.Success !== undefined) {
                        for (const row of tableData) {
                            console.log(`\n📥 [DOWNLOAD RESULT] Booking: "${row.booking_number}"`);
                            console.log(`   Success: ${row.Success ? '✅ YES' : '❌ NO'}`);
                            console.log(`   PO Items: ${row.po_item_file || 'N/A'}`);
                            console.log(`   PDF File: ${row.pdf_file || 'N/A'}`);
                            console.log(`   Status:   ${row.po_status || 'N/A'}`);
                            console.log(`   Message:  ${row.Message || '-'}`);
                        }
                    } else if (tableData[0]?.booking_key || tableData[0]?.rownum || tableData[0]?.comp_cd || tableData[0]?.vendor_cd) {
                        totalStreamedBookings += tableData.length;
                        console.log(`\n📋 [STREAMED CHUNK: +${tableData.length} rows | Cumulative Streamed: ${totalStreamedBookings} rows]`);
                        console.table(tableData.slice(0, 5).map((r: any) => ({
                            Row: r.rownum,
                            Comp: r.comp_cd,
                            Key: r.booking_key,
                            Status: r.status,
                            Vendor: r.vendor_cd,
                            EstRecv: r.est_rcvd_date
                        })));
                        if (tableData.length > 5) {
                            console.log(`... and ${tableData.length - 5} more rows in this chunk`);
                        }
                    }
                }
                return Promise.resolve();
            }
        } as any;

    // 4. Initialize DataManager
    if (isDownloadSelected) {
        console.log(`🔄 Initializing MemoryDataManager with ${selectedBookings.length} selected booking(s)...`);
        app.dateManager = new MemoryDataManager(selectedBookings, app.initData.settings.companyCode);
        await app.dateManager.init();
        console.log(`✅ Loaded ${app.dateManager.length} booking(s) into MemoryDataManager.`);
    } else if (!isPullStatus) {
        console.log('🔄 Initializing Excel DataManager...');
        app.dateManager = new DataManager(app.initData.excelFile);
        await app.dateManager.init();
        console.log(`✅ Loaded ${app.dateManager.length} row(s) from Excel.`);
    }
    app.verified = true;

    // 5. Launch Browser
    console.log('🌐 Launching Microsoft Edge...');
    await app.launchBrowser();

    // 6. Login
    console.log('🔑 Logging into Century VMS portal...');
    app.LocalCom.progress.setTitleAndMessage('Logging in.', 'Trying to log in to the portal.');
    const loginStatus = await login(app);
    console.log('Login Result:', loginStatus);

    if (!loginStatus.success) {
        console.error('❌ Login failed:', loginStatus.message);
        await app.Browser.close();
        process.exit(1);
    }

    // 7. Execute Flow
    app.LocalCom.progress.setTitleAndMessage('Logged-in.', 'Login Success.');
    if (isPullStatus) {
        console.log('✅ Login successful! Starting online booking status pull...');
        await pullBookingStatus(app);
        console.log('🎉 Status pull completed successfully.');
    } else if (isCompareApi) {
        console.log('✅ Login successful! Comparing PO items: export vs API...');
        await comparePoItemsApi(app, selectedBookings.map(b => String(b.booking_number || '').trim()).filter(Boolean));
        console.log('🎉 Comparison finished.');
    } else {
        console.log('✅ Login successful! Starting booking files download...');
        await issueBooking(app);
        console.log('🎉 Booking download process completed.');
    }
}

runLocalTest().catch((err) => {
    console.error('💥 Uncaught error during local test:', err);
});
