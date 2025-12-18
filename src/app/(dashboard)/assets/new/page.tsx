"use client";

import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/forms/asset-form";
import { useProtectPage } from "@/hooks/use-protect-page";
import { PERMISSIONS } from "@/config/roles";
import { toast } from "sonner";
import { AssetFormData } from "@/types/assets";
import { handleApiErrorResponse } from "@/lib/form-errors";

export default function NewAssetPage() {
  useProtectPage();

  const router = useRouter();

  const handleSubmit = async (data: any) => {
    try {
      const fd = new FormData();
      if (data.assetGroupId)
        fd.append("assetGroupId", String(data.assetGroupId));
      if (data.assetCategoryId)
        fd.append("assetCategoryId", String(data.assetCategoryId));
      if (data.assetName) fd.append("assetName", data.assetName);
      if (data.make) fd.append("make", data.make);
      if (data.description) fd.append("description", data.description);
      if (data.purchaseDate) fd.append("purchaseDate", data.purchaseDate);
      if (data.invoiceNo) fd.append("invoiceNo", data.invoiceNo);
      if (data.supplier) fd.append("supplier", data.supplier);
      if (data.invoiceCopyUrl) fd.append("invoiceCopyUrl", data.invoiceCopyUrl);
      if (data.nextMaintenanceDate)
        fd.append("nextMaintenanceDate", data.nextMaintenanceDate);
      if (data.status) fd.append("status", data.status);
      if (data.useStatus) fd.append("useStatus", data.useStatus);

      const docs = Array.isArray(data.assetDocuments)
        ? data.assetDocuments
        : [];
      const metadata = docs.map((doc: any, index: number) => ({
        id: typeof doc.id === "number" ? doc.id : undefined,
        documentName: doc.documentName || "",
        documentUrl:
          typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
        index,
      }));
      fd.append("assetDocuments", JSON.stringify(metadata));
      docs.forEach((doc: any, index: number) => {
        if (doc?.documentUrl instanceof File) {
          fd.append(
            `assetDocuments[${index}][documentFile]`,
            doc.documentUrl,
            doc.documentUrl.name
          );
        }
      });

      const response = await fetch("/api/assets", { method: "POST", body: fd });
      if (!response.ok) await handleApiErrorResponse(response);

      toast.success("Asset created successfully");
      router.push("/assets");
    } catch (error) {
      // If it's a backend validation error, let the form render field errors
      if ((error as any)?.fieldErrors) {
        throw error;
      }
      // Otherwise, show a single toast here and avoid noisy console for expected cases
      const rawMsg =
        error instanceof Error ? error.message : "Failed to create asset";
      const isUnsupported =
        typeof rawMsg === "string" &&
        rawMsg.startsWith("Unsupported file type");
      const isTooLarge =
        typeof rawMsg === "string" && rawMsg.startsWith("File too large");
      if (!isUnsupported && !isTooLarge) {
        console.error("Create asset error:", error);
      }
      const msg = isUnsupported ? "File type is not supported" : rawMsg;
      toast.error(msg);
    }
  };

  const handleCancel = () => {
    router.push("/assets");
  };

  return (
    <div className="container mx-auto py-6">
      <AssetForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
