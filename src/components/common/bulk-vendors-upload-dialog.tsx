"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppButton } from "@/components/common/app-button";
import { toast } from "@/lib/toast";

export type BulkVendorsUploadDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUploadSuccess?: () => void;
};

export function BulkVendorsUploadDialog({
  open,
  onOpenChange,
  onUploadSuccess,
}: BulkVendorsUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const response = await fetch("/api/vendors/template");
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vendors_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download template");
    } finally {
      setDownloading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls")
      ) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setSelectedFile(file);
      setUploadErrors([]);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/vendors/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errs: string[] = Array.isArray(data?.errors)
          ? data.errors
          : typeof data?.message === "string"
          ? [data.message]
          : ["Failed to upload vendors"];
        setUploadErrors(errs);
        toast.error("Validation errors found. Please review the list below.");
        return;
      }
      toast.success(
        data?.message || `Successfully uploaded ${data?.count || 0} vendors`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadErrors([]);
      onUploadSuccess?.();
      onOpenChange?.(false);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage =
        (error as Error).message || "Failed to upload vendors";
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setUploading(false);
    }
  }

  function handleCancel() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadErrors([]);
    onOpenChange?.(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Vendors</DialogTitle>
          <DialogDescription>
            Download the Excel template, fill in vendor details, and upload it
            back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Step 1: Download Template
            </label>
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloading || uploading}
              iconName="Download"
              isLoading={downloading}
            >
              {downloading ? "Downloading..." : "Download Excel Template"}
            </AppButton>
            <p className="text-xs text-muted-foreground">
              Columns: vendorName*, contactPersonName*, addressLine1*,
              addressLine2, state*, city*, pincode, mobile1, mobile2, email,
              alternateEmail1..4, landline1..2, bankName, branchName,
              branchCode, accountNumber, ifscCode, panNumber, gstNumber,
              vatTinNumber, cstInNumber, cinNumber, serviceTaxNumber, stateCode.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Step 2: Upload Filled Template
            </label>
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
              {uploadErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 max-h-48 overflow-auto">
                  <p className="text-sm font-medium text-destructive mb-2">
                    {`Found ${uploadErrors.length} validation error(s):`}
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {uploadErrors.map((e, idx) => (
                      <li key={idx} className="text-destructive">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
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
            {uploading ? "Uploading..." : "Upload"}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
