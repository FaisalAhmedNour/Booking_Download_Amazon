export type ISelectedBookingItem = {
  booking_number: string;
  comp_cd?: string;
  vendor_cd?: string;
  po?: string;
  status?: string;
};

export type IInitData = {
  userName: string;
  password: string;
  excelFile?: string;
  downloadDir?: string;
  mode?: 'download_po' | 'pull_status' | 'download_selected' | string;
  bookings?: ISelectedBookingItem[];
  bookingNumbers?: string[];
  settings: Settings;
};

export interface IBookingStatusCount {
    Booking_Status: string;
    status_count: number;
    status: string;
    sequence?: any;
}

export interface IOnlineBookingGridRow {
    rownum: number;
    comp_cd: string;
    booking_key: string;
    booking_key_for_export?: string;
    est_rcvd_date?: string;
    status: string;
    confirm_date?: string | null;
    planned_vsl?: string | null;
    planned_voyage?: string | null;
    last_modified?: string;
    modify_by?: string;
    misc_value?: any;
    CustomerStatus?: any;
    BookingReviewed?: string;
    documentid?: any;
    VIBEStatus?: any;
    division?: any;
    messagelog?: any;
    customer_booking_number?: string | null;
    pre_issue_fcr?: any;
    vendor_cd?: string;
    sub_vendor_cd?: string | null;
    customBookingId?: any;
    CreatedBy?: string;
}

export type Settings = {
    companyCode: string;
    shipVendorCode?: string;
    contactPhone?: string;
    contactEmail?: string;   
    addEditManufacturer?: string;
    emailAddressToReceiveFCR?: string;
    shipperName?: string;
    downloadPoItems?: boolean;
    downloadPdf?: boolean;
    downloadDir?: string;
    status?: 'Draft' | 'Sent' | string;
    reviewMode?: boolean;
};


export const ColumnAlias={
        'SL NO':"sl",
        'Booking Number':"booking_number",
        'WORKING DATE':"working_date",
        'Ship Mode':"ship_mode",
        'Freight Type':"freight_type",
        'Incoterms':"incoterms",
        'FOB Port':'fob_port',
        'Order Type':"order_type",
        'PO':"po",
        'ASIN':'asin',
        'model':"model",
        'PO Qty':"po_quantity",
        'Case Pack':"case_pack",
        'Carton Qty':"carton_qty",
        'Gross Weight':'gross_weight',
        'Net Weight':'net_weight',
        'CBM':'cbm',
        'Window end':"window_end",
        'ECDD':'ecdd',
        'File':'file',
        'PO status':"po_status",
        'Ship/Vendor Code':"ship_code",
        'Factory':'factory',
        'Ship':"ship"
    } as const;
export type IDataFormExcel = {
                                [K in  typeof ColumnAlias[keyof typeof ColumnAlias]]: string;
                            }&{
                            Success?: boolean;
                            Message?: string;
                            booking_number?: string;
                            booking_created?: string;
                            po_item_file?: string;
                            pdf_file?: string;
};


export type IAuthMetaData={
    "appId": string,
    "attributes": 
    {
      "key": string,
      "values":string[]
    }[],
    "login": string,
    "permissions": string[],
    "metadata": {
        "roles": string[]
    },
    "userData": {
        "firstName": string,
        "lastName": string,
        "description": string,
        "employeeId": string,
        "login": string,
        "mail": string,
        "name": string,
        "company": string,
        "domain": string
    }
}
export type IOrder={
            "id": string,
            "draftOrderArticleDestinationId": number,
            "productionOrderNumber": number,
            "deliveriesNumber": number,
            "unitsQuantity": number,
            "brand": "ZARA SUR",
            "department": "MAN FORMAL",
            "qualityProcess": unknown,
            "status": "DRAFT",
            "product": {
                "id": string,
                "abbreviationOfGmn": string,
                "moca": string,
                "description": string,
                "colors": {
                        "id": string,
                        "name": string,
                        "code": number,
                        "hexCode": string
                    }[],
                "images": string[]
            },
            "hasDocument": boolean,
            "campaign": string,
            "handoverDate": string,
            "serviceDate": unknown,
            "handoverDateCount": number,
            "serviceDateCount": number,
            "okShipping": {
                "statusCode": string,
                "date": unknown
            },
            "supplierId": string,
            "supplyChain": {
                "status": string,
                "assignationDate": unknown
            }
        }
export type IOrderSearchResponse={
    "orders": IOrder[],
    "pagination": {
        "offset": number,
        "limit": number,
        "total": number
    },
    "errors": string[]
}