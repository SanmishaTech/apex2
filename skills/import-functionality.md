# Import Functionality

Data import is primarily handled through Excel files (.xlsx and .xls formats) allowing bulk creation of database entities.

## Supported Formats
- Excel Workbooks (`.xlsx` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- Excel 97-2004 Workbooks (`.xls` / `application/vnd.ms-excel`)

## UI Components
- Reusable React components located in `src/components/common/` handle the client-side experience (e.g., `bulk-entity-upload.tsx`, `bulk-upload-dialog.tsx`).
- These dialogs provide a "Download Template" button that triggers an API route to fetch a pre-formatted Excel template.
- Users upload the filled template via a `<input type="file" />`, which submits the file as `FormData` to the appropriate POST endpoint.

## Template Generation
- API routes like `/api/[entity]/template/route.ts` dynamically generate the Excel templates using the `xlsx` package.
- `XLSX.utils.book_new()` and `XLSX.utils.json_to_sheet()` are used to construct a sheet with predefined column headers. 
- The generated buffer is streamed back to the client as an attachment.

## Parsing Logic and Validation
Import API routes (e.g., `/api/[entity]/upload/route.ts`) implement the core logic:

1. **Access Control**: Validates the user's permissions via `guardApiAccess`.
2. **File Validation**: Extracts the uploaded file from the `FormData` and verifies the MIME type and extension.
3. **Parsing**:
   - The file is converted into an `ArrayBuffer` and read via `XLSX.read(buffer, { type: "buffer" })`.
   - The first worksheet is accessed (`workbook.SheetNames[0]`).
   - The worksheet is converted into JSON objects using `XLSX.utils.sheet_to_json(worksheet)`.
4. **Data Validation**:
   - The API iterates over each row of the parsed JSON data.
   - It performs validation checks, such as ensuring required columns are present and not empty (e.g., `row["Entity Name*"]`).
   - Errors are collected into an array. If validation issues are found, execution halts, and a `400 Bad Request` is returned summarizing the errors (e.g., `Row 2: Entity Name is required`).

## Error Handling and Storage
- **Deduplication**: Before interacting with the database, the code often filters out duplicate rows found *within* the uploaded Excel file using Sets or Maps based on unique fields.
- **Bulk Insert**: The filtered array of objects is passed to Prisma using `createMany()` with `skipDuplicates: true`. This safely ignores records that conflict with existing unique constraints in the database.
- **Error Responses**: Unique constraint violations caught by Prisma are mapped to user-friendly messages, preventing server crashes and clearly indicating to the user that partial or skipped insertions occurred.