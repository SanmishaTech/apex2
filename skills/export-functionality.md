# Export Functionality

The application supports exporting reports, grids, and individual records into Excel (.xlsx) and PDF formats.

## Excel Export (.xlsx)

Excel exports are powered by the `xlsx` library and are primarily used for reporting and data grid downloads.

### Generation Pipeline
1. **Data Retrieval**: Data is retrieved from the database using Prisma and mapped into a 2D array (`Array<Array<any>>`) representing rows and columns, or an array of JSON objects.
2. **Sheet Creation**: `XLSX.utils.aoa_to_sheet()` or `XLSX.utils.json_to_sheet()` is used to convert the data payload into a worksheet object.
3. **Styling and Formatting**:
   - Column widths are often adjusted (`ws["!cols"] = [...]`).
   - For specific reports, individual cell styles (like bold headers) are applied by iterating through the cell references using `XLSX.utils.decode_range()` and `XLSX.utils.encode_cell()`.
4. **Workbook Assembly**: A new workbook is initialized (`XLSX.utils.book_new()`), and the sheet is appended via `XLSX.utils.book_append_sheet()`.
5. **Output**: The workbook is serialized into a buffer (`XLSX.write(wb, { type: "buffer", bookType: "xlsx" })`).

### Download Mechanism
The generated buffer is returned as a `NextResponse` with the appropriate headers:
- `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition`: `attachment; filename="report-name.xlsx"`

## PDF Export (.pdf)

PDF generation is primarily used for official documents like Reports, Invoices, and other generated documents. It relies on the `jspdf` and `jspdf-autotable` libraries.

### Generation Pipeline
1. **Document Initialization**: A new `jsPDF` instance is instantiated (typically configuring `unit: "mm"`, `format: "a4"`).
2. **Layout Construction**:
   - Headers, footers, and structural components (like rectangles and dividing lines) are drawn explicitly using `doc.rect()`, `doc.line()`, and `doc.text()`.
   - Dynamic wrapping and height measurements are computed explicitly before drawing to ensure content fits within the boundaries.
   - External assets, like the company logo, are loaded via `fs.readFile` and inserted using `doc.addImage()`.
3. **Data Tables**: `jspdf-autotable` is utilized to render dynamic grids (e.g., line items on an Invoice). It handles column spans, row spans, styling, and page breaks.
4. **Watermarks**: Depending on the approval status of the document, a large, translucent watermark (e.g., "DRAFT" or "SUSPENDED") may be iterated and drawn across all pages.

### Storage and Download Mechanism
- **Disk Caching**: To prevent redundant generation, generated PDFs are often saved to the file system (e.g., `uploads/documents/doc-123-uuid.pdf`).
- **Response**: The API reads the file using `fs.readFile` and returns it via `NextResponse` with the `application/pdf` content type.
- **Client Handling**: The frontend downloads the blob and triggers a browser download or opens it in a new tab.