import * as fs from "fs";
import randomstring from "randomstring";
function getDayName(day:number){
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day];
}
function getMonthName(mon:number){
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ][mon];
}


export function fileExists(path:string){
    if(fs.existsSync(path)){
        if(fs.statSync(path).isFile()) return true
        else return false
    }else return false
}
export function dirExists(path:string){
    if(fs.existsSync(path)){
        if(fs.statSync(path).isDirectory())return true
        else return false
    }else return false 
}
export function fileReadOK(path:string){
    try {
        fs.accessSync(path,fs.constants.R_OK)
        return true
    } catch (error) {
        return false
    }
}
export function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function ToDayMonthYear(date:Date){
    date.toLocaleString('end',{month:'short',day:'2-digit'})
    return `${getDayName(date.getDay())} ${getMonthName(date.getMonth())} ${date.getDate().toString().padStart(2, '0')} ${date.getFullYear()}`
}
export function ToYYYY_MM_DD(date:Date){
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}


export function isEmpty(value:any){
    if(value==null)
        return true
    else if(Array.isArray(value) && value.length==0)
        return true
    else if (typeof value =='string' && value.trim().length==0)
        return true
    else if (typeof value =='number' && Number.isNaN(value))
        return true
    else return false
}
export class CommonError extends Error{
    code:string
    constructor(messages:string[],code:string,stack?:any){
        super(messages.join("\n* "))
        this.code=code
        if(stack){
            this.stack=stack
        }
    }
    get message(){
        return super.message
    }
}

export function formatDateWithOffset(date:Date, offsetInMinutes:number) {
    // Apply offset in milliseconds
    const localDate = new Date(date.getTime() + offsetInMinutes * 60000);

    // Get formatted ISO string from offset-applied date
    const isoString = localDate.toISOString().replace('Z', '');

    // Format the offset as ±HH:MM
    const offsetHours = String(Math.floor(Math.abs(offsetInMinutes) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(offsetInMinutes) % 60).padStart(2, '0');
    const sign = offsetInMinutes >= 0 ? '+' : '-';

  return `${isoString}${sign}${offsetHours}:${offsetMinutes}`;
}

export type FormattedBoxTypeFromData={
    type: string;
    height: number;
    weight: number;
    length: number;
    volume: number;
    isCustomBox:boolean;
    isOk:boolean;
}
export function formatBoxType(boxType:string,width:string,length:string,height:string):FormattedBoxTypeFromData{
    if(boxType.replaceAll(' ','').toLowerCase()=='custombox'){
        const b= {
            type: "CUSTOM BOX",
            height: Number(height),
            weight: Number(width),
            length: Number(width),
            volume: 0,
            isCustomBox:true,
            isOk:false
        }
        b.volume=(b.height/100)*(b.weight/100)*(b.length/100)
        if(Number.isFinite(b.volume)&& b.volume>0) b.isOk=true
        return b
    }else{
        const [type,dimension]=boxType.split(/\(/).map(e=>e.replace(')','').trim())
    
        const [height,weight,length]=dimension.split('x').map(e=>Number(e.trim()))
        const volume=(height/100)*(weight/100)*(length/100)
        return {
            type,
            height,
            weight,
            length,
            volume:volume,
            isCustomBox:false,
            isOk:(Number.isFinite(volume)&& volume>0)?true:false
        }
    }
}

export function generateInternalReferenceNo(){
    const now=new Date()
    const random=randomstring.generate({
        length:8,
        capitalization:'uppercase',
        charset:'alphanumeric'
    })
    return `${String(now.getFullYear()).substring(2,4)}${String(now.getMonth()+1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${random}`;
}

export function twoDecimalNumber(num:number|string,precision:number=2){
    if(typeof num =='string'){
        num=Number(num)
    }
    const factor=Math.pow(10,precision)
    return Math.round((num + Number.EPSILON) * factor) / factor
}