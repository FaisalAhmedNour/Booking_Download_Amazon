---
- Process Name: BOOKING INDITEX
- Process ID: 6ab80f853e74aaa6b3e91377 
- Buyer Name: Inditex Zara
- Service Name: Partners Product Portal
- Process OTP: 100
- Process Rate: 0.01
---


# User Instruction:
## If using Excl to Download.
### Sheet Name
- The Excel worksheet (tab) name must be exactly '**FORMAT**':
### Required Columns
#### 1. `SL NO` (Serial Number) — **Required**
- Each row **must** have a value in the `SL NO` column.
- If this column is empty, that row will be **skipped** during processing.
#### 2. `ORDER NO` — **Required**
- Each row **must** have a value in the `ORDER NO` column else it will show error.

## If using Date Range to Download.
### Required Field:
- Handover Date Form

# Developer Instruction Backend:
  
in file node_modules\puppeteer-extra\dist\index.esm.js  
change 
```
dep = require(name)();  
```
to 
```
dep = require('puppeteer-extra-plugin-stealth/evasions/chrome.app')();
```

in file node_modules\merge-deep\node_modules\clone-deep\utils.js  
and  
in file  node_modules\merge-deep\node_modules\clone-deep\utils.js  
replace all to  
```
'use strict';  

module.exports = { 
  isObject: require('is-plain-object'),
  clone: require('shallow-clone'),   
  typeOf: require('kind-of'), 
  forOwn: require('for-own') 
  };
```
  
# Forntend Developer Instruction Frontend:
  
## Initialization Data Documentations:
 
-   `userName`:  
        data-type: string  
        field-type: input  
        title: Username  
        required: true  
-   `password`:  
        data-type: string  
        field-type: password  
        title: Password  
        required: true  

-   `excelFile`:  
        data-type: string  
        field-type: file path  
        title: Select Excel File  
        required: true  


```
export type IInitData={
  userName:string,
  password:string,
  excelFile:string,
} ;


type IDataFormExcel = {
    sl: string;
    orderNo: string;
    article: string;
    handoverDate: string;
    handoverTime: string;
    handoverPoint: string;
    pickupAddress: string;
    boxType: string;
    width: string;
    length: string;
    height: string;
    bundles: string;
    units: string;
    grossWeight: string;
    netWeight: string;
    Success?: boolean;
    Message?: string;
}
```

## Message and Process Status Channel:
    `channel`: "d"


## Table Data Structure:
- `SL NO`:  
    data-type:string  
    title:sl
- `Order`:  
    data-type:string  
    title:orderNo
- `ARTICLE`:  
    data-type:string  
    title:article
- `Handover Date`:  
    data-type:string  
    title:handoverDate
- `Handover Time`:  
    data-type:string  
    title:handoverTime
- `Handover Point`:  
    data-type:string  
    title:handoverPoint
- `Pickup Address`:  
    data-type:string  
    title:pickupAddress
- `Box type`:  
    data-type:string  
    title:boxType
- `WIDTH CM (W)`:  
    data-type:string  
    title:width
- `LENGTH CM (L)`:  
    data-type:string  
    title:length
- `HIGHT CM (H)`:  
    data-type:string  
    title:height
- `Bundles`:  
    data-type:string  
    title:bundles
- `Units`:  
    data-type:string  
    title:units
- `Gross weight (KG)`:  
    data-type:string  
    title:grossWeight
- `Net weight (KG)`:  
    data-type:string  
    title:netWeight
- `Success`:  
    data-type:boolean  
    title:Success
- `Message`:  
    data-type:string  
    title:Message