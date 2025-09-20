import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AppButton } from './app-button';
import Image from 'next/image';

export interface ImprovedUploadInputProps {
  control: unknown;
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  itemClassName?: string;
  type?: 'image' | 'document' | 'profile';
  prefix?: string;
  showPreview?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  existingUrl?: string | null;
  onFileUploaded?: (url: string, filename: string) => void;
}

/**
 * Improved UploadInput using the new centralized upload system
 * Automatically uploads files and returns API URLs
 */
export function ImprovedUploadInput({
  control,
  name,
  label,
  description,
  disabled,
  required,
  className,
  itemClassName,
  type = 'image',
  prefix,
  showPreview = false,
  previewWidth = 200,
  previewHeight = 120,
  existingUrl = null,
  onFileUploaded,
}: ImprovedUploadInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl);

  function pickFile() {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }

  function clearFile(onChange: (value: string | null) => void) {
    if (disabled) return;
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setError(null);
    setPreviewUrl(null);
    setUploadedUrl(null);
    onChange(null);
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string | null) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) {
      clearFile(onChange);
      return;
    }

    setFileName(file.name);
    setError(null);
    setUploading(true);

    // Show preview immediately for images
    if (showPreview && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }

    try {
      // Upload file using the new API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (prefix) formData.append('prefix', prefix);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Set the API URL as the form value
      setUploadedUrl(result.url);
      onChange(result.url);
      
      // Call callback if provided
      if (onFileUploaded) {
        onFileUploaded(result.url, result.filename);
      }

      setError(null);
    } catch (error) {
      console.error('Upload error:', error);
      setError((error as Error).message || 'Upload failed');
      clearFile(onChange);
    } finally {
      setUploading(false);
    }
  }

  return (
    <FormField
      // @ts-expect-error relaxed typing
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <FormItem className={itemClassName}>
          <FormLabel>
            {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </FormLabel>
          <div className={cn('flex items-center gap-2', className)}>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              disabled={disabled || uploading}
              aria-required={required}
              onChange={(e) => handleFileChange(e, onChange)}
            />
            <AppButton
              type="button"
              size="sm"
              onClick={pickFile}
              disabled={disabled || uploading}
              isLoading={uploading}
            >
              {uploading ? 'Uploading...' : fileName ? 'Change File' : 'Choose File'}
            </AppButton>
            <div className="text-xs text-muted-foreground truncate max-w-[14rem]" title={fileName}>
              {fileName || 'No file selected'}
            </div>
            {fileName && !uploading && (
              <button
                type="button"
                onClick={() => clearFile(onChange)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          ) : null}
          
          {showPreview && (uploadedUrl || previewUrl) ? (
            <div className="mt-2">
              {previewUrl ? (
                // New file preview
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  width={previewWidth}
                  height={previewHeight}
                  className="rounded border inline-block object-cover"
                />
              ) : uploadedUrl ? (
                // Existing file preview
                /\.(png|jpe?g|webp|gif)$/i.test(uploadedUrl) ? (
                  <Image
                    src={uploadedUrl}
                    alt="Uploaded"
                    width={previewWidth}
                    height={previewHeight}
                    className="rounded border inline-block object-cover"
                  />
                ) : (
                  <a
                    href={uploadedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline"
                  >
                    View uploaded file
                  </a>
                )
              ) : null}
            </div>
          ) : null}
          
          {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}