const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function testFile(filename) {
    const filePath = path.join(__dirname, 'devDoc', filename);
    if (!fs.existsSync(filePath)) {
        console.log('Not found:', filename);
        return;
    }
    console.log('\n--- Testing:', filename, '---');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    workbook.eachSheet((sheet, id) => {
        console.log(`Sheet [${id}]: "${sheet.name}" (actualRowCount: ${sheet.actualRowCount})`);
    });

    const worksheet = workbook.getWorksheet('FORMAT') || workbook.getWorksheet(1);
    console.log('Using worksheet:', worksheet.name);

    for (let r = 1; r <= Math.min(worksheet.actualRowCount, 5); r++) {
        const row = worksheet.getRow(r);
        const rowVals = [];
        row.eachCell({ includeEmpty: false }, (cell, col) => {
            rowVals.push(`[Col ${col}]: text="${cell.text}" value=${JSON.stringify(cell.value)} type=${cell.type}`);
        });
        console.log(`Row ${r}:`, rowVals.join(' | '));
    }
}

async function run() {
    await testFile('BOOKING_FORMAT_CENT_V.0.0.1 DT 26.09.2026.xlsx');
    await testFile('CENTURY VMS.xlsx');
}

run().catch(console.error);
