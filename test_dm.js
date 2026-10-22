const { DataManager } = require('./out/utils/DataManager.js');
const path = require('path');

async function testDM(filename) {
    console.log('\n=== Testing DataManager with:', filename, '===');
    const filePath = path.join(__dirname, 'devDoc', filename);
    const dm = new DataManager(filePath);
    await dm.init();
    console.log('Headers:', dm.headers);
    console.log('Valid rows count:', dm.length);
    console.log('Missing required headers:', dm.missingRequiredHeaders);
    
    if (dm.haveNext()) {
        const data = dm.getData();
        console.log('First PO data (rows count):', data ? data.length : 0);
        console.log('First Row Object:', data ? data[0] : null);
    }
}

async function main() {
    await testDM('BOOKING_FORMAT_CENT_V.0.0.1 DT 26.09.2026.xlsx');
    await testDM('CENTURY VMS.xlsx');
}

main().catch(console.error);
