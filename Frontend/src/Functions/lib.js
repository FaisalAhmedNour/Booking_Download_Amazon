/***********************************************************************/
/************************* Function Name: DataHeaders,*********************
 ***************************************** getShortTypes,*********************
 **************************************** getShortHeaders,*********************
 **************************************** getFullHeaders **********************/

import moment from "moment";

/************************* Creator Name: Rajib *********************/
/************************ Creation Date: 20-Jan-2025 *******************/
/********************** Modification Date: 22-Jan-2025 *****************/

/************************** DataHeaders start ********************/

const DataHeaders = {
  SL: 'SL No',
  CCD:  'Cargo closing date (CC)',
  CAT:  'Category',
  CUR:  'CFURRENCY',
  COM:  'Composition',
  COO:  'Country of Origin',
  DES:  'Destination',
  GRN:  'Gender',
  GSM:  'GSM',
  IOC:  'Issuer of the co.',
  SN:  'ITEM Name',
  ON:  'Order No',
  POL:  'Port Of Loading',
  PPI:  'Price per item',
  PD:  'Print Date',
  QTY:  'Quantity',
  SNU:  'Style Number',
  SSP:  'SubSupplier',
  TED:  'Terms of delivery',
  TA:  'Total amount',
  TB:  'Transportation',
  VEN:  'VENDOR',
  FL:  'file',
  Success: 'Comment'
};
/**************************DataHeaders end ********************/

const dateDataType = ['CCD','PD'];
// const dateDataType = ['CD','ETA'];

const isDateDataType = (key) => {
  return dateDataType.includes(key);
};

const getDateDataTypes = () => {
  return dateDataType;
};

const ImmutableDataKeys = ["SL"]

const isImmutableKey = (key)=>{
  return ImmutableDataKeys.includes(key);
}
const SuccessDataKeys= "Success"

const getSuccessKey = ()=>{
  return SuccessDataKeys;
}

/************************** DataTypes start ********************/
const DataTypes = {
  //Cargo closing date (CC)//
//  CCD?: string 
  ///*Category/
  //CAT?: string 
  ///*CFURRENCY/
  //CUR?: string 
  ///*Composition/
  //COM?: string 
  ///*Country of Origin/
  //COO?: string 
  ///*Destination/
  //DES?: string 
  ///*Gender/
  //GRN?: string 
  ///*GSM/
  //GSM?: number 
  ///*Issuer of the co./
  //IOC?: string 
  ///*ITEM Name/
  //SN?: string 
  ///*Order No/
  //ON?: string 
  ///*Port Of Loading/
  //POL?: string 
  ///*Price per item/
  //PPI?: number 
  ///*Print Date/
  //PD?: string 
  ///*Quantity/
  //QTY?: number 
  ///*Style Number/
  //SNU?: string 
  ///*SubSupplier/
  //SSP?: string 
  ///*Terms of delivery/
  //TED?: string 
  ///*Total amount/
  //TA?: number 
  ///*Transportation/
  //TB?: string 
  ///*VENDOR/
  //VEN?: string 
  ///*file/
  //FL?: string 
  ///*Comment/
  //Success?: boolean; 
};



const inputFieldType = {
      CCD: 'text', 
      CAT: 'text', 
      CUR: 'text', 
      COM: 'text', 
      COO: 'text', 
      DES: 'text', 
      GRN: 'text', 
      GSM: 'number', 
      IOC: 'text', 
      SN: 'text', 
      ON: 'text', 
      POL: 'text', 
      PPI: 'number', 
      PD: 'text', 
      QTY: 'number', 
      SNU: 'text', 
      SSP: 'text', 
      TED: 'text', 
      TA: 'number', 
      TB: 'text', 
      VEN: 'text', 
      FL: 'text', 
      // Success: 'boolean',; 
  };

  const numberDataTypes = ['SL','GSM','PPI','QTY','TA']

  const isNumberType = (key)=>{
    return numberDataTypes.includes(key);
  }
  
  const getInputFieldType = (key)=>{
    return inputFieldType[key]?inputFieldType[key]:"text";
  }



/************************** DataTypes end ********************/

/************************** getShortHeaders start ********************/
const getShortHeaders = () => Object.keys(DataHeaders);
/************************** getShortHeaders end ********************/

/************************** getFullHeaders Start ********************/
const getFullHeaders = () => Object.values(DataHeaders);
/************************** getFullHeaders end ********************/

/************************** getDataKeysToShowInTable Start ********************/
const getDataKeysToShowInTable = () => {
  const allKeys = Object.keys(DataHeaders);
  const filteredKeys = allKeys.filter((key) => key != "Success");
  return filteredKeys;
};

/************************** getDataKeysToShowInTable end ********************/

/************************** getHeadersToShowInTable Start ********************/
const getHeadersToShowInTable = () => {
  const allHeaders = Object.values(DataHeaders);
  const filteredKeys = allHeaders.filter((key) => key != "Comment");
  return filteredKeys;
};

/************************** getHeadersToShowInTable end ********************/

const convertToNormalDate = (IsoDate) => {
  try {
    const data = moment(IsoDate).format("YYYY-MM-DD")
    return data;
  } catch (e) {
    return "";
  }
};

const convertToISODate = (date, splitAt = "/") => {
  // console.log(date)
  try {
    const parsedDate = new Date(
      date + ' GMT+6'
    );
    console.log(parsedDate.toISOString());
    return parsedDate.toISOString();
  } catch (e) {
    console.log("Error:", e.message);
    return "";
  }
};

const convertToNumber = (str) => {
    if (typeof str !== 'string') return NaN; // If it's not a string, return NaN
    
    // Trim any extra spaces from the string
    str = str.trim();
  
    // Try to parse as a float first
    const floatNumber = parseFloat(str);
    
    // If the result is a valid float (not NaN), check if it's actually an integer
    if (!isNaN(floatNumber)) {
      // Check if the number is an integer (i.e., has no fractional part)
      if (floatNumber % 1 === 0) {
        return parseInt(str, 10); // Return as integer
      } else {
        return floatNumber; // Return as float
      }
    }
  
    // If it's not a valid number, return NaN
    return NaN;
  };
  

export {
  DataHeaders,
  DataTypes,
  getShortHeaders,
  getFullHeaders,
  getDataKeysToShowInTable,
  getHeadersToShowInTable,
  convertToNormalDate,
  convertToISODate,
  isDateDataType,
  getDateDataTypes,
  getInputFieldType,
  convertToNumber,
  isNumberType,
  isImmutableKey,
  getSuccessKey
};
