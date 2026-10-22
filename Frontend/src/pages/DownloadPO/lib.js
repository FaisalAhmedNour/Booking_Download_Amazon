
export const headers = {
    "sl": "SL NO",
    "booking_number": "Booking Number",
    "po": "PO",
    "po_item_file": "PO Item File",
    "pdf_file": "PDF File",
    "po_status": "Booking Status",
    "booking_created": "Booking Created",
    "Success": "Success",
    "Message": "Message",
};

export const headersForPulling = {
    "sl": "SL NO",
    "booking_number": "Booking Number",
    "po": "PO",
    "po_item_file": "PO Item File",
    "pdf_file": "PDF File",
    "po_status": "Booking Status",
    "booking_created": "Booking Created",
    "Success": "Success",
    "Message": "Message",
};

export const fullHeaders = Object.values(headers);
export const headerKeys = Object.keys(headers);
export const fullHeadersForPulling = Object.values(headersForPulling);
export const headerKeysForPulling = Object.keys(headersForPulling);

export const vendorOptions = [
    {
        sl: 1,
        shipVendorCode: "EPLYL",
        factory: "EGMCL",
        vendorFullName: "EPLYL - Epic Garments DWC LLC|EPIC Garments Manufacturing Co. Ltd (S004877)|ST-636242|PBGO-Laem Chabang|WW|Private Brands",
        addEditManufacturer: "EPIC Garments Manufacturing Co. Ltd.",
        lengthOfVFN: 122,
        contactPhone: "01914434666",
        contactEmail: "alauddinc@epicbd.com",
        emailAddressToReceiveFCR: "alauddinc@epicbd.com",
        shipperName: "Epic Garments DWC LLC",
        label: "EGMCL - EPLYL",
        value: "EPLYL - Epic Garments DWC LLC|EPIC Garments Manufacturing Co. Ltd (S004877)|ST-636242|PBGO-Laem Chabang|WW|Private Brands"
    },
    {
        sl: 2,
        shipVendorCode: "EPLYM",
        factory: "CIPL",
        vendorFullName: "EPLYM - Epic Garments DWC LLC|Cosmopolitan Industries Pvt. Ltd.|ST-36907|PBGO-Laem Chabang|WW|Private Brands",
        addEditManufacturer: "Cosmopolitan Industries Pvt. Ltd.",
        lengthOfVFN: 109,
        contactPhone: "01914434666",
        contactEmail: "alauddinc@epicbd.com",
        emailAddressToReceiveFCR: "alauddinc@epicbd.com",
        shipperName: "Epic Garments DWC LLC",
        label: "CIPL - EPLYM",
        value: "EPLYM - Epic Garments DWC LLC|Cosmopolitan Industries Pvt. Ltd.|ST-36907|PBGO-Laem Chabang|WW|Private Brands"
    },
    {
        sl: 3,
        shipVendorCode: "EPLYO",
        factory: "GTL",
        vendorFullName: "EPLYO - Epic Garments DWC LLC|Green Textile Limited|ST-376714|PBGO-Laem Chabang|WW|Private Brands",
        addEditManufacturer: "Green Textile Limited",
        lengthOfVFN: 98,
        contactPhone: "01914434666",
        contactEmail: "alauddinc@epicbd.com",
        emailAddressToReceiveFCR: "alauddinc@epicbd.com",
        shipperName: "Epic Garments DWC LLC",
        label: "GTL - EPLYO",
        value: "EPLYO - Epic Garments DWC LLC|Green Textile Limited|ST-376714|PBGO-Laem Chabang|WW|Private Brands"
    },
    {
        sl: 4,
        shipVendorCode: "EPLYP",
        factory: "PGCL",
        vendorFullName: "EPLYP - Epic Garments DWC LLC|Pearl Garments Co., Ltd.|ST-781381|PBGO-Laem Chabang|WW|Private Brands",
        addEditManufacturer: "Pearl Garments Co., Ltd.",
        lengthOfVFN: 101,
        contactPhone: "01914434666",
        contactEmail: "alauddinc@epicbd.com",
        emailAddressToReceiveFCR: "alauddinc@epicbd.com",
        shipperName: "Epic Garments DWC LLC",
        label: "PGCL - EPLYP",
        value: "EPLYP - Epic Garments DWC LLC|Pearl Garments Co., Ltd.|ST-781381|PBGO-Laem Chabang|WW|Private Brands"
    },
    {
        sl: 5,
        shipVendorCode: "N/A",
        factory: "",
        vendorFullName: "",
        addEditManufacturer: "",
        lengthOfVFN: 0,
        contactPhone: "",
        contactEmail: "",
        emailAddressToReceiveFCR: "",
        shipperName: "",
        label: "N/A",
        value: "N/A"
    }
];

export const companyCodeOptions = [
    {
        sl: 1,
        companyCode: "589 - Amazon Multi Country Consolidation Thailand",
        shipToShortCode: "THNC",
        label: "589 - Amazon Multi Country Consolidation Thailand",
        value: "589 - Amazon Multi Country Consolidation Thailand"
    },
    {
        sl: 2,
        companyCode: "840 - Amazon Europe",
        shipToShortCode: "",
        label: "840 - Amazon Europe",
        value: "840 - Amazon Europe"
    },
    {
        sl: 3,
        companyCode: "992 - Amazon.com Services LLC",
        shipToShortCode: "",
        label: "992 - Amazon.com Services LLC",
        value: "992 - Amazon.com Services LLC"
    },
    {
        sl: 4,
        companyCode: "993 - Amazon Japan",
        shipToShortCode: "",
        label: "993 - Amazon Japan",
        value: "993 - Amazon Japan"
    }
];

export const vendorTableData = vendorOptions;
export const companyTableData = companyCodeOptions;

export const getStoredVendorOptions = () => {
    try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('centuryvms_booking_vendors') : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed?.TableData)) {
                return parsed.TableData.map(row => ({
                    sl: row["Sl No"],
                    shipVendorCode: row["Ship/Vendor Code"],
                    factory: row["Factory"],
                    vendorFullName: row["VENDOR FULL NAME"],
                    addEditManufacturer: row["Add/Edit Manufacturer"],
                    lengthOfVFN: row["LENGTH OF V.F.N."],
                    shipperName: row["Shipper Name"] || "Epic Garments DWC LLC",
                    contactPhone: row["Contact Phone (optional)"] || "",
                    contactEmail: row["Contact Email"] || "",
                    emailAddressToReceiveFCR: row["Email address to receive FCR"] || "",
                    label: row["Factory"] ? `${row["Factory"]} - ${row["Ship/Vendor Code"]}` : row["Ship/Vendor Code"],
                    value: row["VENDOR FULL NAME"] || row["Ship/Vendor Code"]
                }));
            }
        }
    } catch (e) {
        console.error("Error reading stored vendor options:", e);
    }
    return vendorOptions;
};

export const getStoredCompanyOptions = () => {
    try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('centuryvms_booking_company_codes') : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed?.TableData)) {
                return parsed.TableData.map(row => ({
                    sl: row["Sl No"],
                    companyCode: row["Company Code"],
                    shipToShortCode: row["SHIP TO SHORT CODE"] || "",
                    label: row["Company Code"],
                    value: row["Company Code"]
                }));
            }
        }
    } catch (e) {
        console.error("Error reading stored company code options:", e);
    }
    return companyCodeOptions;
};