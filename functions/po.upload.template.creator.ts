import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export class CsvWriter {
    private readonly tempDir: string;
    private readonly filePath: string;

    // Row 1 is the header.
    private currentRow = 2;

    private static readonly headers = [
        "Serial Number",
        "PO #",
        "ASIN #",
        "Model #",
        "ASIN FC",
        "Add/Edit Country/Region of Origin (COO)",
        "Ordered Units",
        "Booked Units",
        "Unit of Measure",
        "Booked Units in other booking",
        "Booked Cartons",
        "Net Weight (KG)",
        "Booked Volume",
        "Volume UOM",
        "Booked Weight",
        "Weight UOM",
        "Last Ship Date",
        "Estimated Delivery Date",
        "PO Item Description",
        "Carrier Item Description",
        "Stuffing Location Name",
        "Manufacturer Name",
        "Shipping Marks",
        "Harmonized Tariff Code",
        "Inspection PO Approve",
        "Inspection Approve",
        "Cargo Type ID",
        "Cargo Type",
        "Item Certificate Approved",
        "Remarks in FCR",
        "Sort"
    ];

    private constructor(
        tempDir: string,
        filePath: string,
    ) {
        this.tempDir = tempDir;
        this.filePath = filePath;
    }

    /**
     * Creates a new CSV file in the system temp directory.
     */
    public static async create(): Promise<CsvWriter> {
        const tempDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "csv-writer-"),
        );

        const filePath = path.join(
            tempDir,
            `${crypto.randomUUID()}.csv`,
        );

        const writer = new CsvWriter(
            tempDir,
            filePath,
        );

        await writer.initialize();

        return writer;
    }

    /**
     * Creates the CSV and writes the header row.
     */
    private async initialize(): Promise<void> {
        const headerLine = CsvWriter.headers
            .map((header) => CsvWriter.escapeCsvValue(header))
            .join(",");

        await fs.writeFile(
            this.filePath,
            `${headerLine}\r\n`,
            "utf8",
        );
    }

    /**
     * Appends a row and saves it immediately.
     *
     * Returns the Excel-style row number that was written.
     */
    public async appendRow(values: unknown[]): Promise<number> {
        if (values.length !== CsvWriter.headers.length) {
            throw new Error(
                `Invalid column count. Expected ${CsvWriter.headers.length}, received ${values.length}.`,
            );
        }

        const csvLine =
            values
                .map((value) => CsvWriter.escapeCsvValue(value))
                .join(",") + "\r\n";

        const rowNumber = this.currentRow;

        await fs.appendFile(
            this.filePath,
            csvLine,
            "utf8",
        );

        this.currentRow++;

        return rowNumber;
    }

    /**
     * Returns the row number that will be used
     * for the next append.
     */
    public getCurrentRow(): number {
        return this.currentRow;
    }

    /**
     * Returns the path to the temporary CSV file.
     */
    public getFilePath(): string {
        return this.filePath;
    }

    /**
     * Returns the CSV contents as a Buffer.
     */
    public async getBuffer(): Promise<Buffer> {
        return fs.readFile(this.filePath);
    }

    /**
     * Returns the CSV contents as Base64 if needed
     * for uploading to another API.
     */
    public async getBase64(): Promise<string> {
        const buffer = await this.getBuffer();

        return buffer.toString("base64");
    }

    /**
     * Deletes the temporary CSV and its directory.
     */
    public async cleanup(): Promise<void> {
        await fs.rm(this.tempDir, {
            recursive: true,
            force: true,
        });
    }

    /**
     * Escapes a value according to CSV rules.
     */
    private static escapeCsvValue(value: unknown): string {
        if (value === null || value === undefined) {
            return "";
        }

        const stringValue = String(value);

        // CSV requires quotes around values containing:
        // comma, quote, CR, or LF.
        if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\r") ||
            stringValue.includes("\n")
        ) {
            return `"${stringValue.replaceAll('"', '""')}"`;
        }

        return stringValue;
    }
}