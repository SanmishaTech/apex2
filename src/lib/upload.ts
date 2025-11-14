// Server-only file for file system operations
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { UploadConfig, UploadResult } from './upload-config';
import { 
  imageUploadConfig, 
  documentUploadConfig, 
  profileImageConfig,
  noticeDocumentUploadConfig,
} from './upload-config';

// Re-export types and configs from client-safe module
export type { UploadConfig, UploadResult };
export { 
  imageUploadConfig, 
  documentUploadConfig, 
  profileImageConfig,
  noticeDocumentUploadConfig,
};

/**
 * Handle file upload with validation and secure storage
 */
export async function handleFileUpload(
  file: File,
  config: UploadConfig = imageUploadConfig,
  customPrefix?: string
): Promise<UploadResult> {
  try {
    // Validate file type
    if (!config.allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: `Invalid file type. Allowed: ${config.allowedTypes.join(', ')}`,
      };
    }

    // Validate file size
    if (file.size > config.maxSize) {
      return {
        success: false,
        error: `File too large. Maximum size: ${(config.maxSize / (1024 * 1024)).toFixed(2)}MB`,
      };
    }

    // Generate secure filename
    const fileExtension = path.extname(file.name);
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const prefix = customPrefix ? `${customPrefix}-` : '';
    const filename = `${prefix}${timestamp}-${randomId}${fileExtension}`;

    // Create upload directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), config.uploadDir);
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // Full file path
    const filePath = path.join(uploadPath, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);

    return {
      success: true,
      filename,
      publicUrl: filename, // Return filename for API URL construction
    };
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: 'Failed to upload file',
    };
  }
}

/**
 * Delete a file from the upload directory
 */
export async function deleteUploadedFile(
  filename: string,
  uploadDir: string = 'uploads/images'
): Promise<boolean> {
  try {
    const fullPath = path.join(process.cwd(), uploadDir, filename);
    
    if (existsSync(fullPath)) {
      await unlink(fullPath);
      return true;
    }
    return true; // File doesn't exist, consider it deleted
  } catch (error) {
    console.error('File deletion error:', error);
    return false;
  }
}

/**
 * Get MIME type based on file extension
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validate filename to prevent path traversal attacks
 */
export function isValidFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  
  // Check for valid characters (alphanumeric, dash, underscore, dot)
  const validPattern = /^[a-zA-Z0-9.\-_]+$/;
  return validPattern.test(filename);
}