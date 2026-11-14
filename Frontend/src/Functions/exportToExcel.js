const exportToExcel = async (
    data = [],
    headers = [],
    filename = 'export',
    setIsDownloading = () => {},
    includeTable = false
) => {
    try {
        setIsDownloading(true);
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        // Sanitize headers to ensure non-empty, unique column names for OpenXML table compatibility
        const seenHeaders = new Map();
        const safeHeaders = (headers && headers.length > 0 ? headers : (data?.[0] ? Object.keys(data[0]) : ['Column 1'])).map((h, idx) => {
            let base = String(h || `Column ${idx + 1}`).trim();
            if (!base) base = `Column ${idx + 1}`;
            const count = seenHeaders.get(base) || 0;
            seenHeaders.set(base, count + 1);
            return count === 0 ? base : `${base} (${count + 1})`;
        });

        // Map original headers to safe unique names
        const rawHeaders = headers && headers.length > 0 ? headers : safeHeaders;

        // Clean row data replacing undefined / null with empty string
        const safeRows = (data || []).map(row => {
            return rawHeaders.map(h => {
                const val = row?.[h];
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') {
                    try { return JSON.stringify(val); } catch { return String(val); }
                }
                return val;
            });
        });

        if (includeTable && safeRows.length > 0) {
            try {
                // Table name must be alphanumeric and start with a letter/underscore
                const safeTableName = `Table_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                worksheet.addTable({
                    name: safeTableName,
                    ref: 'A1',
                    headerRow: true,
                    style: {
                        theme: 'TableStyleMedium2',
                        showRowStripes: true,
                    },
                    columns: safeHeaders.map(header => ({ name: header, filterButton: true })),
                    rows: safeRows,
                });
            } catch (tableErr) {
                console.warn('addTable failed, falling back to standard rows:', tableErr);
                worksheet.addRow(safeHeaders);
                safeRows.forEach(r => worksheet.addRow(r));
            }
        } else {
            worksheet.addRow(safeHeaders);
            safeRows.forEach(r => worksheet.addRow(r));
        }

        // Auto-fit column widths
        worksheet.columns.forEach((column, colIdx) => {
            const headerLen = String(safeHeaders[colIdx] || '').length;
            let maxLen = headerLen;
            const sampleCount = Math.min(safeRows.length, 50);
            for (let i = 0; i < sampleCount; i++) {
                const cellLen = String(safeRows[i]?.[colIdx] ?? '').length;
                if (cellLen > maxLen) maxLen = cellLen;
            }
            column.width = Math.max(Math.min(maxLen + 4, 45), 12);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const randomFourDigitNumber = Math.floor(1000 + Math.random() * 9000);
        const cleanName = String(filename || 'export').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName}_${randomFourDigitNumber}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('exportToExcel failed:', err);
    } finally {
        setIsDownloading(false);
    }
};

export default exportToExcel;
