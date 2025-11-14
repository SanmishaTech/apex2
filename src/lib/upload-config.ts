export interface UploadConfig {
  allowedTypes: string[];
  maxSize: number;
  uploadDir: string;
}

export interface UploadResult {
  success: boolean;
  filename?: string;
  publicUrl?: string;
  url?: string;
  error?: string;
}

// Default configurations for different file types
export const imageUploadConfig: UploadConfig = {
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: 10 * 1024 * 1024, // 10MB
  uploadDir: 'uploads/images',
};

export const documentUploadConfig: UploadConfig = {
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  maxSize: 20 * 1024 * 1024, // 20MB
  uploadDir: 'uploads/documents',
};

export const noticeDocumentUploadConfig: UploadConfig = {
  allowedTypes: documentUploadConfig.allowedTypes,
  maxSize: documentUploadConfig.maxSize,
  uploadDir: 'uploads/notices',
};

export const profileImageConfig: UploadConfig = {
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxSize: 5 * 1024 * 1024, // 5MB
  uploadDir: 'uploads/profiles',
};

/**
 * Client-side file upload to API endpoint
 */
export async function uploadFile(
  file: File,
  type: 'image' | 'document' | 'profile' = 'image',
  prefix?: string
): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (prefix) {
      formData.append('prefix', prefix);
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Upload failed',
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'Failed to upload file',
    };
  }
}
