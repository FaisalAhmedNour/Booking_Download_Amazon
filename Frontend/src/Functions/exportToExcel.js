const exportToExcel = async (
    data = [],
    headers = [],
    filename = 'export',
    setIsDownloading,
    includeTable = false
) => {
    setIsDownloading(true);
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    if (includeTable) {
        worksheet.addTable({
            name: 'MyTable',
            ref: `A1`,
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true,
            },
            columns: headers?.map(header => ({ name: header, filterButton: true })),
            rows: data?.map(row => headers?.map(header => row[header])),
        });
    }
    else {
        worksheet.addRow(headers);

        data.forEach(row => {
            worksheet.addRow([row?.id, row?.title, row?.completed]);
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const randomFourDigitNumber = Math.floor(1000 + Math.random() * 9000);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${randomFourDigitNumber}.${includeTable ? 'xlsx' : 'csv'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsDownloading(false);
    URL.revokeObjectURL(url);
};

export default exportToExcel;