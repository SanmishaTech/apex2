'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AppButton } from '@/components/common/app-button';
import { toast } from '@/lib/toast';
import { apiGet } from '@/lib/api-client';

export type BulkManpowerUploadDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUploadSuccess?: () => void;
};

export function BulkManpowerUploadDialog({ open, onOpenChange, onUploadSuccess }: BulkManpowerUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const response = await fetch('/api/manpower/template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manpower_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download template');
    } finally {
      setDownloading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/manpower/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        // Format error message properly for display
        let errorMessage = data?.message || data?.error || 'Failed to upload manpower data';
        
        // If it's a validation error with multiple lines, format it better
        if (errorMessage.includes('\n')) {
          // Split by newline and display in console for full details
          console.error('Upload validation errors:', errorMessage);
          
          // Show a summary in the toast
          const lines = errorMessage.split('\n');
          const firstLine = lines[0];
          errorMessage = firstLine + (lines.length > 1 ? '. Check console for details.' : '');
        }
        
        throw new Error(errorMessage);
      }

      toast.success(data?.message || `Successfully uploaded ${data?.count || 0} manpower records`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess?.();
      onOpenChange?.(false);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = (error as Error).message || 'Failed to upload manpower data';
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setUploading(false);
    }
  }

  function handleCancel() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange?.(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Manpower</DialogTitle>
          <DialogDescription>
            Download the Excel template, fill in the manpower details, and upload it back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Download Template Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Step 1: Download Template</label>
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloading || uploading}
              iconName="Download"
              isLoading={downloading}
            >
              {downloading ? 'Downloading...' : 'Download Excel Template'}
            </AppButton>
            <p className="text-xs text-muted-foreground">
              The template contains all mandatory fields for manpower entry.
            </p>
          </div>

          {/* Upload File Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Step 2: Upload Filled Template</label>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploading}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={uploading}
            iconName="X"
          >
            Cancel
          </AppButton>
          <AppButton
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            iconName="Upload"
            isLoading={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
