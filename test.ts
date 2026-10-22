import { DataManager } from "./utils/DataManager";

import { CsvWriter } from "./functions/po.upload.template.creator";

// import { ExcelGridWriter } from "./functions/po.upload.template.creator";

const dm= new DataManager("D:\\Automate Tool\\Modules\\ERP\\CENTURY_VMS\\BOOKING\\devDoc\\BOOKING_FORMAT_CENT_V.0.0.1 DT 26.09.2026.xlsx")

dm.init().then(()=>{
    while(dm.haveNext()){
        const d=dm.getData();
        console.log("dm.getData()?.length",d?.[0]);
        dm.next()
    }
})

// CsvWriter.create().then(async (csv)=>{

//     await csv.appendRow([
//             ,                   // "Serial Number",
//             "PO #",             // "PO #",
//             "ASIN #",           // "ASIN #",
//             "Model #",          // "Model #",
//             ,                   // "ASIN FC",
//             ,                   // "Add/Edit Country/Region of Origin (COO)",
//             ,                   // "Ordered Units",
//             "Booked Units",     // "Booked Units",
//             ,                   // "Unit of Measure",
//             ,                   // "Booked Units in other booking",
//             "Booked Cartons",   // "Booked Cartons",
//             "Net Weight (KG)",  // "Net Weight (KG)",
//             "Booked Volume",    // "Booked Volume",
//             ,                   // "Volume UOM",
//             "Booked Weight",    // "Booked Weight",
//             ,                   // "Weight UOM",
//             ,                   // "Last Ship Date",
//             ,                   // "Estimated Delivery Date",
//             ,                   // "PO Item Description",
//             ,                   // "Carrier Item Description",
//             ,                   // "Stuffing Location Name",
//             ,                   // "Manufacturer Name",
//             ,                   // "Shipping Marks",
//             ,                   // "Harmonized Tariff Code",
//             ,                   // "Inspection PO Approve",
//             ,                   // "Inspection Approve",
//             ,                   // "Cargo Type ID",
//             ,                   // "Cargo Type",
//             ,                   // "Item Certificate Approved",
//             ,                   // "Remarks in FCR",
//             ,                   //"Sort"
//         ])  

//     console.log(csv.getCurrentRow()); // 4
//     console.log(csv.getFilePath());

//     // const file = await csv.getBuffer();

//     // When completely finished:
//     // await csv.cleanup();
//  });
