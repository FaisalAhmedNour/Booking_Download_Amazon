import {
    useState,
    useEffect,
} from 'react';
import Swal from 'sweetalert2';
import {
    getUpdatedInfo,
    GetExpLCContactFile,
} from '../Services/AuthService';
import xmlbuilder from 'xmlbuilder';

const ConvertData = () => {

    const [BIN, setBIN] = useState('');
    const [unitCode, setUnitCode] = useState([]);
    const [signatory, setSignatory] = useState([]);
    const [countryCode, setCountryCode] = useState([]);
    const [currencyCode, setCurrencyCode] = useState([]);
    const [incotermCode, setIncotermCode] = useState([]);
    const [allLcContact, setAllLcContact] = useState([]);

    const getCurrencyCode = async () => {
        try {
            const response = await fetch('/CurrencyCodes.json')
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            setCurrencyCode(data);
        } catch (error) {
            console.error('Error fetching JSON:', error);
        }
    }

    const getCountryCode = async () => {
        try {
            const response = await fetch('/CountryCodes.json')
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            setCountryCode(data);
        } catch (error) {
            console.error('Error fetching JSON:', error);
        }
    }

    const getUnitCode = async () => {
        try {
            const response = await fetch('/UnitCodes.json')
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            setUnitCode(data);
            // console.log("yes it is", data);
        } catch (error) {
            console.error('Error fetching JSON:', error);
        }
    }

    const getIncotermCode = async () => {
        try {
            const response = await fetch('/Incoterms.json')
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            setIncotermCode(data);
        } catch (error) {
            console.error('Error fetching JSON:', error);
        }
    };

    const getBIN = async () => {
        const result = await getUpdatedInfo('6578e4ecf0464d7fb253de58');
        if (result?.status !== 200) {
            Swal.fire({
                icon: "error",
                title: "Error!",
                text: "Something went wrong! Please Check your engine is running.",
            });
        }
        else {
            setSignatory(result.data.metaData?.[0]?.Signatorys)
            const allBIN = result.data.metaData?.[0]?.BIN_INFORMATIONT;
            allBIN?.forEach(bin => {
                bin?.BIN?.length === 11 && (
                    setBIN(bin?.BIN)
                )
            })
        }
    }

    const getLCContact = async () => {
        const result = await GetExpLCContactFile(0, 10000, undefined, undefined, {
            "query": {
                "LC Number": undefined,
            }
        })
        setAllLcContact(result?.data?.list);
    }

    useEffect(() => {
        getBIN();
        getUnitCode();
        getLCContact();
        getCountryCode();
        getCurrencyCode();
        getIncotermCode();
    }, [])

    const currentYear = new Date().getFullYear();

    const arrayOfObjectToXML = async (data) => {
        const root = xmlbuilder.create('EXP_ISSUE', { version: '1.0', encoding: 'UTF-8', standalone: true });
        root.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');

        data.forEach((item) => {
            const selectedSignatory = signatory.find(name => name.SignatoryName === item?.data?.payload?.['Signatory'])
            const selectedLc = allLcContact?.find(lc => lc?.['LC Number'] === item?.data?.payload?.['Master LC/Contract No']);
            const currency = selectedLc?.Currency;
            const foundCurrencyCode = currencyCode?.find(code => code.name === currency);
            const foundUnitCode = unitCode?.find(code => code?.name === item?.data?.payload?.Unit);
            const foundCountryCode = countryCode?.find(code => code?.name === item?.data?.payload?.['Country Code']);
            const foundIncotermCode = incotermCode?.find(code => code?.name?.slice(0, 3)?.toUpperCase() === item?.data?.payload?.['Incoterm Used']?.slice(0, 3)?.toUpperCase());
            // const foundIncotermCode = incotermCode?.find(code => {
            //     console.log(code?.name?.slice(0, 3)?.toUpperCase());
            //     console.log(item?.data?.payload?.['Incoterm Used']?.slice(0, 3)?.toUpperCase());
            // });
            // console.log(foundIncotermCode);

            const dataElement = root.ele('DATA');
            dataElement.ele('SLNO', item?.data?.payload?.['SL.No']);
            dataElement.ele('FLC_NO', item?.data?.payload?.['Master LC/Contract No']);
            dataElement.ele('CURRENCY', foundCurrencyCode?.code);
            dataElement.ele('COUNTRY', foundCountryCode?.code);
            dataElement.ele('AREA_CODE', item?.data?.payload?.['Area Code'] || '01');
            dataElement.ele('BIN', BIN);
            dataElement.ele('EXP_YEAR', currentYear);
            dataElement.ele('ADSCODE', selectedLc?.AD);
            dataElement.ele('COMMODITY_CODE', item?.data?.payload?.['Commodity Code']);
            dataElement.ele('DEST_PORT', item?.data?.payload?.['Destination Port'] || '.');
            dataElement.ele('UNIT', foundUnitCode?.code);
            dataElement.ele('QUANTITY', item?.data?.payload?.Quantity);
            dataElement.ele('INVOICE_NO', item?.data?.payload?.['Invoice No'] || '');
            dataElement.ele('AMOUNT_INV', item?.data?.payload?.['Invoice Amount']);
            dataElement.ele('INCOTERM', foundIncotermCode?.termId);
            dataElement.ele('FOB_AMOUNT', item?.data?.payload?.['Invoice Amount']);
            dataElement.ele('FREIGHT', item?.data?.payload?.['FREIGHT'] || 'NA');
            dataElement.ele('INSURANCE', item?.data?.payload?.['INSURANCE'] || 'NA');
            dataElement.ele('OTHER_CHARGES', item?.data?.payload?.['OTHER_CHARGES'] || 'NA');
            dataElement.ele('CMT_AMOUNT', item?.data?.payload?.['CMT_AMOUNT'] || 'NA');
            dataElement.ele('CARRIER', item?.data?.payload?.['CARRIER'] || 'NA');
            dataElement.ele('TRANS_DOC_TYPE', item?.data?.payload?.['TRANS_DOC_TYPE'] || 'NA');
            dataElement.ele('SHIP_PORT', item?.data?.payload?.['SHIP_PORT'] || '1');
            dataElement.ele('SECTOR', item?.data?.payload?.['SECTOR'] || '1');
            dataElement.ele('SIGNATORY_ID', selectedSignatory?.SignatoryID);
        });

        const xmlString = root.end({ pretty: true });

        return xmlString;
    }


    return {
        arrayOfObjectToXML
    }
};

export default ConvertData;
