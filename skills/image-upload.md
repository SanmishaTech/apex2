# Image and Document Uploads

The application implements a custom file upload mechanism using the local filesystem.

## Accepted File Types and Limits
Upload configuration is centralized in `src/lib/upload-config.ts`.
- **Images (`imageUploadConfig`)**: Accepts `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`. Limit: 10MB. Stored in `uploads/images`.
- **Profile Images (`profileImageConfig`)**: Accepts `image/jpeg`, `image/jpg`, `image/png`, `image/webp`. Limit: 5MB. Stored in `uploads/profiles`.
- **Documents (`documentUploadConfig`)**: Accepts PDFs, MS Word, plain text, CSV, and Excel files. Limit: 20MB. Stored in `uploads/documents`.

## Upload Flow

### Client-Side
1. A file is selected via an `<input type="file" />` within a React component.
2. The file is appended to a `FormData` object along with metadata (e.g., `type: 'image'`, `prefix: 'entity'`).
3. The `uploadFile` helper function (`src/lib/upload-config.ts`) executes a `POST` request to `/api/upload` (or a specific entity route).

### Server-Side Processing
1. **Endpoint**: The generic `/api/upload/route.ts` or entity-specific routes handle the incoming `FormData`.
2. **Handling & Validation**: Execution is passed to `handleFileUpload` (`src/lib/upload.ts`).
   - Validates the MIME type against the configured `allowedTypes`.
   - Validates the file size against the configured `maxSize`.
3. **Storage Strategy**:
   - Files are stored **locally** on the server's disk (within `process.cwd()/uploads/...`).
   - A secure, collision-resistant filename is generated using a prefix, timestamp, and a crypto UUID (e.g., `entity-1700000000-uuid.jpg`).
   - Target directories are automatically created using `fs/promises.mkdir` if they do not exist.
   - The file is converted to a Buffer and written using `fs/promises.writeFile`.

## Accessing Files
- The API returns a public relative path (e.g., `/api/uploads/images/filename.jpg` or `/uploads/...`).
- Database records store this relative string path.
- The frontend references this URL in `<img>` tags or download links. 
- Specific API routes (e.g., `/api/uploads/images/[filename]/route.ts`) act as static file servers. They resolve the absolute disk path, verify it against directory traversal vulnerabilities, determine the MIME type, and return the file buffer to the client.