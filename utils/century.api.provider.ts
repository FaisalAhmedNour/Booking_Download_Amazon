import axios, { AxiosInstance } from "axios"
import { FormattedBoxTypeFromData, sleep } from "./common"
import { writeFileSync } from "fs"
import { Page } from "puppeteer-core"

export interface EachSearchResult {
  status: string
  transportRequestInfo: TransportRequestInfo
  finishedProductDetail: FinishedProductDetail
}

export interface TransportRequestInfo {
  id: string
  orderId: string
  orderNumber: string
  orderType: number
  orderSampleTypeId: any
  destinationLocationId: string
  originMarketId: number
  handoverDate: string
  quantity: number
  pendingQuantity: number
  sentQuantity: number
  enteredQuantity: number
  quantityWithOutDetail: number
  restRequestLineId: string
  supplier: ID_Name
  forwarder: ID_Name
  companyGroup: ID_Name
  incoterm: string
  purchaseCenterId: number
  serviceDateId: number
  serviceDate: string
  transportOrderTypeId: number
  paymentMethodId: number
  currencyId: number
  transportMeanId: string
  brand: Brand
  section: Section
  orderCategoryIds: any[]
  stages: any[]
  journey: Journey[]
  iopTransportRequest: boolean
  unassignedManualEntries: number
  unassignedManualEntriesQuantity: number
  hasShipment: boolean
  serviceTypeId: string
  presentationTypeId: string
  density: any
}


export interface ID_Name {
  id: string
  name: string
}

export interface Brand {
  id: number
  description: string
}

export interface Section {
  id: number
  description: string
}

export interface Journey {
  origin: string
  originShort: string
  originDesc: string
  originMarket: string
  destination: string
  destinationShort: string
  destinationDesc: string
  destinationMarket: string
  arrivalDate: any
  departureDate: any
  transportInfo: TransportInfo
  isSupplierFacilities: boolean
}

export interface TransportInfo {
  type: string
  company: string
}

export interface FinishedProductDetail {
  id: number
  name: string
  campaign: ID_Name
  product: any
  department: any
  reference: string
  quality: string
  defaultImage: string
  units: number
  colors: Color[]
}


export interface Color {
  description: string
  hex: string
  ref: number
  code: string
  imageUrl: string
  sizes: Size[]
}

export interface Size {
  size: Size2
  units: number
  pendingQuantity: number
  enteredQuantity: number
  packingQuantity: any
}

export interface Size2 {
  ref: number
  code: string
  description: string
}

type ISearchResultRes={
    data: EachSearchResult[],
    "pagination": {
        "offset": number,
        "limit": number,
        "total": number
    }
}
type IHandOverPoint={
            "value": number,
            "label": string
        }
type IHandOverPointsRes={
    "data": IHandOverPoint[]
}
type IExistingShipments={
  "data": 
    {
      "id": string,
      "internalReference": string,
      "type": number,
      "status":string,
      "sentDate": string,
      "cargoReadyDate": null,
      "cargoSentDate": null,
      "forwarder": {
        "id": string,
        "name": null
      },
      "supplier": string,
      "totalQuantity": 15000.0,
      "transportData": {
        "estimatedHandoverDate": string,
        "deliveryPlaceType": number,
        "deliveryPlace": string
      },
      "transportRequests": 
        {
          "id": string,
          "requestLineId": string,
          "serviceDateId": number,
          "orderId": number,
          "order": number,
          "packingId": string,
          "purchaseCenterId": number,
          "estimatedCargo": {
            "colors": [
              number
            ],
            "presentationTypeId": string,
            "boxTypes": [
              {
                "boxType": string,
                "dimensions": null,
                "bundles": number
              }
            ],
            "hangingGarments": [],
            "units": number,
            "volume": number,
            "meters": null,
            "netWeight": number,
            "grossWeight": number
          }
        }[],
      "packingHeaders": 
        {
          "transportRequestId": string,
          "volume": number,
          "meters": null,
          "netWeight": number,
          "grossWeight": number
        }[],
      "bundles": [],
      "remainBundles": [],
      "hangingGarments": [],
      "handover": {
        "id": string,
        "forwarderProposal": {
          "proposalDate": string,
          "companyId": string,
          "role": string,
          "handoverData": {
            "handoverPoint": number,
            "physicalLocationId": string,
            "handoverDate": string
          }
        },
        "status": string
      },
      "courierInfo": null,
      "invoice": null,
      "subStatus": {
        "handoverReal": string,
        "ple": string,
        "documentation": string,
        "service": null
      },
      "isIop": true
    }[]
}

type ITransportRequestResponse={
  status: string
  transportRequestInfo: {
    id: string
    orderId: string
    orderNumber: string
    orderType: number,
    orderSampleTypeId: null,
    destinationLocationId: string
    handoverDate: string
    quantity: number,
    pendingQuantity: number,
    sentQuantity: number,
    enteredQuantity: number,
    quantityWithOutDetail: number,
    restRequestLineId: string
    supplier: {
      id: string
      name: string
    },
    forwarder: {
      id: string
      name: string
    },
    companyGroup: {
      id: string
      name: string
    },
    incoterm: string
    purchaseCenterId: number,
    serviceDateId: number,
    serviceDate: string
    transportOrderTypeId: number,
    paymentMethodId: number,
    currencyId: number,
    subSectionId: number,
    transportMeanId: string
    brand: {
      id: number,
      description: string
    },
    section: {
      id: number,
      description: string
    },
    orderCategoryIds: [],
    journey: [
      {
        origin: string
        originShort: string
        originDesc: string
        originMarket: string
        destination: string
        destinationShort: string
        destinationDesc: string
        destinationMarket: string
        arrivalDate: null,
        departureDate: null,
        transportInfo: {
          type: string
          company: string
        },
        isSupplierFacilities: false
      }
    ],
    stages: [
      {
        origin: string
        originShort: string
        originDesc: string
        originMarket: string
        destination: string
        destinationShort: string
        destinationDesc: string
        destinationMarket: string
        arrivalDate: string
        departureDate: string
        transportInfo: {
          type: string
          company: string
        },
        isSupplierFacilities: false
      },
      {
        origin: string
        originShort: string
        originDesc: string
        originMarket: string
        destination: string
        destinationShort: string
        destinationDesc: string
        destinationMarket: string
        arrivalDate: string
        departureDate: string
        transportInfo: {
          type: string
          company: string
        },
        isSupplierFacilities: false
      }
    ],
    iopTransportRequest: true,
    manualEntriesQuantity: number,
    hasShipment: true
  },
  finishedProductDetail: {
    id: number,
    name: string
    campaign: {
      id: number,
      description: string
    },
    product: null,
    department: null,
    reference: string
    quality: string
    defaultImage: string
    units: number,
    colors: [
      {
        description: string
        hex: string
        ref: number,
        code: string
        imageUrl: string
        sizes: [
          {
            size: {
              ref: number,
              code: string
              description: string
            },
            units: number,
            pendingQuantity: number,
            enteredQuantity: number,
            packingQuantity: null
          },
          {
            size: {
              ref: number,
              code: string
              description: string
            },
            units: number,
            pendingQuantity: number,
            enteredQuantity: number,
            packingQuantity: null
          },
          {
            size: {
              ref: number,
              code: string
              description: string
            },
            units: number,
            pendingQuantity: number,
            enteredQuantity: number,
            packingQuantity: null
          },
          {
            size: {
              ref: number,
              code: string
              description: string
            },
            units: number,
            pendingQuantity: number,
            enteredQuantity: number,
            packingQuantity: null
          }
        ]
      }
    ]
  }
}

type IPickUpAddress={   
        id: string,
        description: string,
        address: string,
        address_tlc: string,
    }

type IPostStageInfoRes={
    data: {
      origin: string,
      originShort: string
      originDesc: string
      originMarket: string
      destination: string
      destinationShort: string
      destinationDesc: string
      destinationMarket: string
      arrivalDate: string
      departureDate: string
      transportInfo: {
        type: string,
        company: string
      },
      isSupplierFacilities: true
    }[]
}

// type ICreateBookingPayload={
//     id: string|null;
//     internalReference: string
//     type: number, 
//     status: string
//     sentDate: string
//     totalQuantity: number,
//     transportType:string,
//     cargoReadyDate: null,
//     cargoSentDate: null,
//     presentationTypeId: string,
//     transportData: {
//             estimatedHandoverDate: string
//             deliveryPlace: string
//             deliveryPlaceType: number,
//             isCargoReady: false,
//             isCargoSent: false
//         },
//     courierInfo: null,
//     bundles: [],
//     remainBundles: [],
//     invoice: null,
//     transportRequests:{
//                 id: string
//                 packingId: string|null
//                 purchaseCenterId: number,
//                 orderId: number,
//                 serviceDateId: number,
//                 forwarder: {
//                     id: string
//                     name: string
//                 },
//                 requestLineId: string
//                 estimatedCargo: {
//                     colors: number[],
//                     presentationTypeId: string
//                     boxTypes: [
//                         {
//                             boxType: string
//                             bundles: number,
//                             dimensions: null|{
//                                                 height: number,
//                                                 length: number,
//                                                 width: number
//                                             },
//                             isCustomBox?: boolean
//                         }
//                     ],
//                     hangingGarments: [],
//                     units: number,
//                     volume: number,
//                     netWeight: number,
//                     grossWeight: number
//                 },
//                 order: number
//             }[],
//     subStatus: {
//         handoverReal: string
//         ple: string
//         documentation: string
//     },
//     packingHeaders: 
//             {
//                 transportRequestId: string
//                 volume: number,
//                 netWeight: number,
//                 grossWeight: number
//             }[],
    
//     handover: null,
//     isIop: true,
//     hangingGarments: []
// }

export interface ICreateBookingPayload {
  id: any
  internalReference: string
  typeId: number
  transportType: string
  status: string
  sentDateTime: string
  totalQuantity: number
  presentationTypeId: string
  transportData: TransportData
  courierInfo: any
  transportRequests: TransportRequest[]
  containers: any[]
  invoice: any
  packingHeaders: PackingHeader[]
  handover: any
  subStatus: SubStatus
  isIop: boolean
}

export interface TransportData {
  estimatedHandoverDateTime: string
  deliveryPlaceType: number
  deliveryPlaceId: string
  cargoReadyDateTime: any
  cargoSentDateTime: any
  isCargoReady: boolean
  isCargoSent: boolean
}

export interface TransportRequest {
  id: string
  packingId: any
  purchaseCenterId: number
  orderId: number
  serviceDateId: number
  requestLineId: string
  forwarder: Forwarder
  estimatedCargo: EstimatedCargo
  order: number
}

export interface Forwarder {
  id: string
  name: string
}

export interface EstimatedCargo {
  colors: number[]
  presentationTypeId: string
  boxTypes: (BoxType|CustomBoxType)[]
  hangingGarments: any[]
  units: number
  volume: number
  netWeight: number
  grossWeight: number
}

export interface BoxType {
  boxType: string
  bundles: number
  dimensions: any
  isCustomBox: boolean
}
export interface CustomBoxType{
                        boxType: string,
                        bundles: number,
                        dimensions: {
                            height: number,
                            length: number,
                            width: number
                        }
                    }

export interface PackingHeader {
  transportRequestId: string
  volume: number
  netWeight: number
  grossWeight: number
}

export interface SubStatus {
  handoverReal: string
  ple: string
  documentation: string
}

// export interface ICreateBookingPayload {
//   id: string
//   internalReference: string
//   typeId: number
//   incoterm: string
//   transportType: string
//   status: string
//   sentDateTime: string
//   totalQuantity: number
//   presentationTypeId: string
//   transportData: TransportData
//   courierInfo: any
//   transportRequests: TransportRequest[]
//   containers: any[]
//   invoice: any
//   packingHeaders: PackingHeader[]
//   handover: Handover
//   subStatus: SubStatus
//   isIop: boolean
// }

export interface TransportData {
  estimatedHandoverDateTime: string
  deliveryPlaceType: number
  deliveryPlaceId: string
  cargoReadyDateTime: any
  cargoSentDateTime: any
  isCargoReady: boolean
  isCargoSent: boolean
}

export interface EstimatedCargo {
  colors: number[]
  presentationTypeId: string
  boxTypes: (BoxType|CustomBoxType)[]
  hangingGarments: any[]
  units: number
  volume: number
  netWeight: number
  grossWeight: number
}

export interface BoxType {
  boxType: string
  dimensions: any
  bundles: number
  isCustomBox: boolean
}

export interface PackingHeader {
  transportRequestId: string
  volume: number
  netWeight: number
  grossWeight: number
}

export interface Handover {
  id: string
  forwarderProposal: ForwarderProposal
  status: string
}

export interface ForwarderProposal {
  proposalDateTime: string
  companyId: string
  role: string
  handoverData: HandoverData
}

export interface HandoverData {
  handoverPoint: number
  physicalLocationId: string
  handoverDateTime: string
}

export interface SubStatus {
  handoverReal: string
  ple: string
  documentation: string
}


type IGetBoxTypeRes={
      id: string,
      ref: number,
      purchaseCenterId: number,
      height: number,
      width: number,
      length: number,
      description: string
    }
const replacementReg=/\s|\n|#|,|-|\.|-/g

export interface IUploadCSVResult {
    success: boolean;
    message?: string;
    errors?: string[];
    raw?: any;
}

export class CenturyAPIProvider{
    protected instance:AxiosInstance
    protected hanoverPoints:IHandOverPoint[]|undefined;
    protected pickUpAddressCache:Record<string,IPickUpAddress[]>={}
    protected boxTypeCache:Record<number,IGetBoxTypeRes[]>={}
    constructor(instance:AxiosInstance){
        this.instance=instance
    }
    async searchBookingItem(bookingKey:string,poNo:string,asin:string):Promise<{found:boolean;message?:string;data?:any}>{
        try {
            const whereClauseObj={
                poNo:` = '${poNo.trim()}'`,
                item:` = '${asin.trim()}'`
            };
            const whereClauseStr=JSON.stringify(whereClauseObj);
            const encodedWhere=encodeURIComponent(whereClauseStr);
            const url=`/Vob/Vob/SearchBookingItem?formId=1000015&whereClause=${encodedWhere}&bookingKey=${encodeURIComponent(bookingKey)}&isLoadSizeData=false`;
            const resp=await this.instance.get(url,{
                headers:{
                    Origin:"https://www.centuryvms.com",
                    Referer:"https://www.centuryvms.com/"
                }
            });
            if(resp?.status===200){
                const resData=resp.data;
                if(resData){
                    if(Array.isArray(resData)){
                        return {found:resData.length>0,data:resData};
                    }
                    if(Array.isArray(resData.GridDataTable)){
                        return {found:resData.GridDataTable.length>0,data:resData.GridDataTable};
                    }
                    if(Array.isArray(resData.ResultData)){
                        return {found:resData.ResultData.length>0,data:resData.ResultData};
                    }
                    if(resData.GridDataSet){
                        return {found:true,data:resData.GridDataSet};
                    }
                    if(resData.Succeeded===false){
                        return {found:false,message:resData.Message||"Search failed in Century VMS."};
                    }
                    if(resData.data&&Array.isArray(resData.data)){
                        return {found:resData.data.length>0,data:resData.data};
                    }
                    return {found:true,data:resData};
                }
                return {found:false,message:"Empty response from SearchBookingItem"};
            }
            return {found:false,message:`SearchBookingItem returned status ${resp?.status}`};
        } catch (error:any) {
            const errorMsg=error?.response?.data?.Message||error?.response?.data?.message||(error instanceof Error?error.message:String(error));
            return {found:false,message:errorMsg};
        }
    }
    async uploadCSV(file:Buffer,bookingKey:string,companyId:string):Promise<IUploadCSVResult>{
        try {
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(file)], {
                type: "text/csv",
            });
            formData.append("file[]",blob,"VobItemDetailGridAddItem1790352488295.csv");
            formData.append("ComponentName", "VobItemDetailGrid");
            formData.append(
                "ApiRouteQueryString",
                `modulecd=Vob&configName=VobWorkspace&bookingKey=${bookingKey}&compCd=${companyId}`
            );
            formData.append(
                "ConfigRoute",
                "https://apidr.centuryvms.com/api/ple/PageLayout/GetByConfigName?moduleCd=Vob&configName=VobWorkspace&applicationName=Vms"
            );
            formData.append("UseGridAdmin", "true");
            formData.append("CustomWorkSheetName", "");
            formData.append("UseFieldTypeValidation", "false");
            formData.append("UsePleValidation", "false");
            formData.append("PleValidationDisplayLine", "10");
            formData.append("fileName", "VobItemDetailGridAddItem1790352488295.csv");
            formData.append("PostUploadBinary", "false");
            formData.append("DataSource", "null");
            formData.append("CustomExportServiceName", "ExcelExportCustomService");
            formData.append(
                "ApiRoute",
                `https://apidr.centuryvms.com/api/VOB/Vob/AddItemFromExcelRevised?modulecd=Vob&configName=VobWorkspace&bookingKey=${bookingKey}&compCd=${companyId}`
              );
            const resp=await this.instance.post('/ple/Grid/ImportDataByApi',formData,{
              headers:{
                queryparams: `{"modulecd":"Vob","configName":"VobWorkspace","bookingKey":"${bookingKey}","compCd":"${companyId}"}`,

                Origin: "https://www.centuryvms.com",
                Referer: "https://www.centuryvms.com/"
              }
            })
            if(resp?.status===200){
                const data=resp.data;
                if(data&&typeof data==='object'){
                    if(data.Succeeded===false||data.success===false){
                        const errMsg=data.Message||data.message||data.ErrorMessage||"Upload rejected by Century VMS.";
                        return {success:false,message:errMsg,raw:data};
                    }
                }
                return {success:true};
            }
            return {success:false,message:`Server returned status ${resp?.status}`};
        } catch (error:any) {
            let errorMsg="CSV upload request failed.";
            let rawData:any=undefined;
            if(error?.response?.data){
                rawData=error.response.data;
                if(typeof rawData==='string'){
                    errorMsg=rawData;
                }else if(typeof rawData==='object'){
                    errorMsg=rawData.Message||rawData.message||rawData.ExceptionMessage||JSON.stringify(rawData);
                }
            }else if(error instanceof Error){
                errorMsg=error.message;
            }
            return {success:false,message:errorMsg,raw:rawData};
        }
    }
    async getPdfBase64(page: Page): Promise<string> {
        const startTime = Date.now();
        const timeoutMs = 60_000;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const res = await page.evaluate(async () => {
                    // @ts-ignore
                    let rv = typeof $find !== 'undefined' ? $find("ReportViewer1") : null;
                    if (!rv) {
                        const iframes = document.querySelectorAll('iframe');
                        for (let i = 0; i < iframes.length; i++) {
                            try {
                                const win = iframes[i].contentWindow as any;
                                if (win && typeof win.$find !== 'undefined') {
                                    rv = win.$find("ReportViewer1");
                                    if (rv) break;
                                }
                            } catch (e) {}
                        }
                    }

                    if (!rv) {
                        return { status: 'waiting', message: 'ReportViewer1 not found' };
                    }

                    // Check ASP.NET AJAX Async Postback status
                    // @ts-ignore
                    if (typeof Sys !== 'undefined' && Sys?.WebForms?.PageRequestManager) {
                        // @ts-ignore
                        const prm = Sys.WebForms.PageRequestManager.getInstance();
                        if (prm && prm.get_isInAsyncPostBack && prm.get_isInAsyncPostBack()) {
                            return { status: 'waiting', message: 'PageRequestManager is in async postback' };
                        }
                    }

                    // Check ReportViewer loading state
                    if (typeof rv.get_isLoading === 'function' && rv.get_isLoading()) {
                        return { status: 'waiting', message: 'ReportViewer is loading' };
                    }

                    // @ts-ignore
                    const internalViewer = rv._getInternalViewer ? rv._getInternalViewer() : null;
                    if (!internalViewer || !internalViewer.ExportUrlBase) {
                        return { status: 'waiting', message: 'ExportUrlBase not available yet' };
                    }

                    let url = internalViewer.ExportUrlBase + encodeURIComponent("PDF");
                    if (!url.startsWith("http://") && !url.startsWith("https://")) {
                        url = new URL(url, window.location.origin).href;
                    }

                    try {
                        const response = await fetch(url, {
                            credentials: "include"
                        });

                        if (!response.ok) {
                            return { status: 'waiting', message: `Fetch returned ${response.status}: ${response.statusText}` };
                        }

                        const buffer = await response.arrayBuffer();
                        if (!buffer || buffer.byteLength === 0) {
                            return { status: 'waiting', message: 'Empty buffer returned' };
                        }

                        const bytes = new Uint8Array(buffer);

                        // Verify that response is valid PDF content (magic header %PDF)
                        if (bytes.length < 4 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
                            return { status: 'waiting', message: 'Received non-PDF content (report may still be generating)' };
                        }

                        // Convert ArrayBuffer → Base64
                        let binary = "";
                        const chunkSize = 0x8000;

                        for (let i = 0; i < bytes.length; i += chunkSize) {
                          binary += String.fromCharCode(
                              ...bytes.subarray(i, i + chunkSize)
                          );
                        }

                        return { status: 'ok', data: btoa(binary)};
                    } catch (fetchErr) {
                        return { status: 'waiting', message: String(fetchErr) };
                    }
                });

                if (res.status === 'ok' && res.data) {
                    return res.data;
                }

                console.log("[downloadPDF] Waiting for report generation...", res.message);
            } catch (err) {
                console.log("[downloadPDF] Retry evaluate:", err);
            }

            await sleep(2000);
        }

        throw new Error("Timed out waiting for ReportViewer1 to finish rendering PDF.");
    }
    async downloadPDF(page:Page,bookingKey:string){
        await page.goto(`https://www.centuryvms.com/#/pagelayout?modulecd=Reporting&configName=ReportShellMain&runReport=1&bypassconfirm=true&reportCd=BookingConfirmation&s_1=${bookingKey}&s_2=Origin`,{waitUntil:"load", timeout: 60_000});
        try {
            await page.waitForSelector('#ReportViewer1, iframe[src*="ReportViewer"], iframe',{timeout:30_000});
        } catch (e) {
            console.log("[downloadPDF] Selector wait timed out, continuing with evaluation...");
        }
        await sleep(3000);
        return await this.getPdfBase64(page)
    }

    async getOnlineBookingStatusSummary(moduleCd: string = "Vob", configName: string = "VobVendorOnlineBookingStatusRtn"): Promise<{ success: boolean; data?: any; message?: string }> {
        try {
            const url = `/Vob/Vob/GetVendorOnlineBookingStatusRtn?moduleCd=${encodeURIComponent(moduleCd)}&configName=${encodeURIComponent(configName)}`;
            const resp = await this.instance.get(url, {
                headers: {
                    Origin: "https://www.centuryvms.com",
                    Referer: "https://www.centuryvms.com/"
                }
            });

            if (resp?.status === 200 && resp.data) {
                return { success: true, data: resp.data };
            }
            return { success: false, message: `Status summary request failed with status: ${resp?.status}` };
        } catch (error: any) {
            try {
                const fallbackUrl = `/Vob/Vob/GetVendorOnlineBookingStatusRtnGrid?moduleCd=${encodeURIComponent(moduleCd)}&configName=${encodeURIComponent(configName)}`;
                const fallbackResp = await this.instance.get(fallbackUrl, {
                    headers: {
                        Origin: "https://www.centuryvms.com",
                        Referer: "https://www.centuryvms.com/"
                    }
                });
                if (fallbackResp?.status === 200 && fallbackResp.data) {
                    return { success: true, data: fallbackResp.data };
                }
            } catch {}
            const errMsg = error?.response?.data?.Message || error?.response?.data?.message || (error instanceof Error ? error.message : String(error));
            return { success: false, message: errMsg };
        }
    }

    async getOnlineBookingStatusGrid(status: string, moduleCd: string = "Vob", configName: string = "VobVendorOnlineBookingStatusRtn"): Promise<{ success: boolean; data?: any; message?: string }> {
        try {
            const encodedWhere = encodeURIComponent(`status = '${status}'`);
            const url = `/Vob/Vob/GetVendorOnlineBookingStatusRtnGrid?whereClause=${encodedWhere}&moduleCd=${encodeURIComponent(moduleCd)}&configName=${encodeURIComponent(configName)}`;
            const resp = await this.instance.get(url, {
                headers: {
                    Origin: "https://www.centuryvms.com",
                    Referer: "https://www.centuryvms.com/"
                }
            });

            if (resp?.status === 200 && resp.data) {
                return { success: true, data: resp.data };
            }
            return { success: false, message: `Grid request failed with status: ${resp?.status}` };
        } catch (error: any) {
            const errMsg = error?.response?.data?.Message || error?.response?.data?.message || (error instanceof Error ? error.message : String(error));
            return { success: false, message: errMsg };
        }
    }
}



