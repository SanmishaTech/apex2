# Image & File Handling System

This document describes the improved image and file handling system implemented in apex2, inspired by the agriskills project.

## Overview

The new system provides:
- ✅ Centralized upload utilities
- ✅ Clean API structure for serving files
- ✅ Secure file storage outside public directory
- ✅ Automatic file validation and processing
- ✅ React components with built-in upload functionality

## Architecture

### File Storage
Files are stored **outside** the `public` directory for better security:
```
project-root/
├── uploads/
│   ├── images/         # General images
│   ├── documents/      # PDF, DOC, etc.
│   └── profiles/       # Profile pictures
└── public/             # Static assets only
```

### API Routes
- `/api/images/[filename]` - Serves images
- `/api/documents/[filename]` - Serves documents  
- `/api/upload` - Handles file uploads

## Usage Examples

### 1. Basic Upload Component

```tsx
import { ImprovedUploadInput } from '@/components/common';

<ImprovedUploadInput
  control={control}
  name="documentUrl"
  label="Upload Document"
  type="document"
  showPreview={true}
  onFileUploaded={(url, filename) => {
    console.log('File uploaded:', { url, filename });
  }}
/>
```

### 2. Profile Picture Upload

```tsx
<ImprovedUploadInput
  control={control}
  name="profileImage"
  label="Profile Picture"
  type="profile"
  showPreview={true}
  previewWidth={150}
  previewHeight={150}
/>
```

### 3. Manual Upload via API

```tsx
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'image');
  formData.append('prefix', 'product');
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  // result.url contains the API URL to serve the file
};
```

## File Types & Configurations

### Image Files
- **Types**: JPEG, PNG, GIF, WebP
- **Max Size**: 10MB
- **Storage**: `uploads/images/`
- **API**: `/api/images/[filename]`

### Documents
- **Types**: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX
- **Max Size**: 20MB
- **Storage**: `uploads/documents/`
- **API**: `/api/documents/[filename]`

### Profile Images
- **Types**: JPEG, PNG, WebP
- **Max Size**: 5MB
- **Storage**: `uploads/profiles/`
- **API**: `/api/images/[filename]`

## Security Features

1. **Path Traversal Protection**: Filename validation prevents `../` attacks
2. **File Type Validation**: Only allowed MIME types are accepted
3. **Size Limits**: Configurable file size limits
4. **Secure Naming**: UUID-based filenames prevent conflicts
5. **Access Control**: Upload API requires authentication

## Migration from Old System

### Before (Old System)
```tsx
// Files stored in public/uploads - direct access
<img src="/uploads/notices/filename.jpg" />

// Complex path handling in single route
const absolutePath = path.join(process.cwd(), 'public', 'uploads', filePath);
```

### After (New System)
```tsx
// Files served through API - controlled access
<img src="/api/images/filename.jpg" />

// Clean, dedicated routes for each file type
const filePath = path.join(process.cwd(), 'uploads', 'images', filename);
```

## Benefits

1. **Better Security**: Files not directly accessible, served through API
2. **Clean Architecture**: Separate routes for different file types
3. **Consistent Validation**: Centralized file validation logic
4. **Easy Migration**: Can coexist with existing system
5. **Better Performance**: Proper caching headers and file streaming

## File Naming Convention

Generated filenames follow this pattern:
```
[prefix-]timestamp-uuid.ext
```

Examples:
- `notice-1726215600000-a1b2c3d4-e5f6.pdf`
- `1726215600000-a1b2c3d4-e5f6.jpg`
- `profile-1726215600000-a1b2c3d4-e5f6.png`

## Error Handling

The system provides comprehensive error handling:
- File type validation
- File size limits
- Upload failures
- Serving errors
- Path traversal attempts

## Testing

To test the new system:
1. Use the improved notice form: `/notices/improved-notice-form.tsx`
2. Upload different file types and sizes
3. Verify files are served correctly via API routes
4. Check security by trying invalid filenames

## Next Steps

1. Migrate existing forms to use `ImprovedUploadInput`
2. Update database schemas to store API URLs instead of file paths
3. Add image optimization/resizing capabilities
4. Implement file cleanup for unused uploads