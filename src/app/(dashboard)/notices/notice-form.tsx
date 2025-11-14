"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppButton } from "@/components/common/app-button";
import { toast } from "@/lib/toast";
import { apiPost, apiPatch } from "@/lib/api-client";
import { formatDateForInput } from "@/lib/locales";
import { useProtectPage } from "@/hooks/use-protect-page";
import { PERMISSIONS } from "@/config/roles";
import { NoticeInitialData } from "@/types/notices";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

interface NoticeFormProps {
  mode: "create" | "edit";
  initial?: NoticeInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}
export function NoticeForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/notices",
  mutate,
}: NoticeFormProps) {
  useProtectPage();

  const router = useRouter();
  const { backWithScrollRestore } = useScrollRestoration("notices-list");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(
    initial?.documentUrl || null
  );
  const [mainDocumentFile, setMainDocumentFile] = useState<File | null>(null);
  const [noticeDocuments, setNoticeDocuments] = useState<Array<{ id?: number; documentName: string; documentUrl: string | File | null; _tempId?: number }>>([]);

  const schema = z.object({
    noticeDate: z.string().min(1, "Notice Date is required"),
    noticeHeading: z.string().min(1, "Heading is required"),
    notice: z.string().min(1, "Notice content is required"),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      noticeDate: initial?.noticeHead
        ? initial.noticeHead
        : formatDateForInput(new Date()),
      noticeHeading: initial?.noticeHeading || "",
      notice: initial?.noticeDescription || "",
    },
  });
  const { control, handleSubmit, watch } = form;

  useEffect(() => {
    if (initial?.noticeDocuments && Array.isArray(initial.noticeDocuments)) {
      setNoticeDocuments(
        initial.noticeDocuments.map((d) => ({
          id: d.id,
          documentName: d.documentName || "",
          documentUrl: d.documentUrl || "",
        }))
      );
    }
  }, [initial]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        "Invalid file type. Please select PDF, Word document, or image file."
      );
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB.");
      return;
    }

    setUploading(true);
    try {
      setMainDocumentFile(file);
      setUploadedFileUrl(null);
      toast.success("File ready for upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const baseFields = {
        noticeHead: values.noticeDate,
        noticeHeading: values.noticeHeading,
        noticeDescription: values.notice,
        documentUrl: uploadedFileUrl,
      };

      const hasDocFiles = noticeDocuments.some((d) => d.documentUrl instanceof File);
      const shouldUseFormData = !!mainDocumentFile || hasDocFiles;

      if (shouldUseFormData) {
        const fd = new FormData();
        fd.append("noticeHead", baseFields.noticeHead);
        fd.append("noticeHeading", baseFields.noticeHeading);
        if (baseFields.noticeDescription) fd.append("noticeDescription", baseFields.noticeDescription);
        if (!mainDocumentFile && baseFields.documentUrl) fd.append("documentUrl", baseFields.documentUrl);
        if (mainDocumentFile) {
          fd.append("document", mainDocumentFile, mainDocumentFile.name);
        }

        const meta = noticeDocuments.map((doc, index) => ({
          id: typeof doc.id === "number" && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || "",
          documentUrl: typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
          index,
        }));
        if (noticeDocuments.length > 0) {
          fd.append("noticeDocuments", JSON.stringify(meta));
        }
        noticeDocuments.forEach((doc, index) => {
          if (doc.documentUrl instanceof File) {
            fd.append(`noticeDocuments[${index}][documentFile]`, doc.documentUrl, doc.documentUrl.name);
          }
        });

        const endpoint = mode === "create" ? "/api/notices" : `/api/notices/${initial?.id}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const res = await fetch(endpoint, { method, body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${res.status}`);
        }
        toast.success(`Notice ${mode === "create" ? "created" : "updated"} successfully`);
      } else {
        const jsonPayload: any = {
          ...baseFields,
          noticeDocuments: noticeDocuments.map((d) => ({
            id: d.id,
            documentName: d.documentName,
            documentUrl: typeof d.documentUrl === "string" ? d.documentUrl : undefined,
          })),
        };
        if (mode === "create") {
          await apiPost("/api/notices", jsonPayload);
          toast.success("Notice created successfully");
        } else {
          await apiPatch(`/api/notices/${initial?.id}`, jsonPayload);
          toast.success("Notice updated successfully");
        }
      }

      // Invalidate and revalidate the cache
      if (mutate) {
        await mutate();
      }

      router.push("/notices");
    } catch (error) {
      toast.error((error as Error).message || "Failed to save notice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {mode === "create" ? "Create Notice" : "Edit Notice"}
          </AppCard.Title>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection>
              <FormRow cols={2} from="md">
                <TextInput
                  control={control}
                  name="noticeDate"
                  label="Notice Date"
                  type="date"
                  placeholder="Select notice date"
                />
                <TextInput
                  control={control}
                  name="noticeHeading"
                  label="Heading"
                  placeholder="Enter notice heading"
                />
              </FormRow>
              <FormRow>
                <TextareaInput
                  control={control}
                  name="notice"
                  label="Notice"
                  placeholder="Enter notice content..."
                  rows={6}
                />
              </FormRow>
              <FormRow>
                <div className="space-y-3 w-full">
                  <label className="block text-sm font-medium">Documents</label>
                  {noticeDocuments.length === 0 && (
                    <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                      No documents added.
                    </div>
                  )}
                  <div className="space-y-3">
                    {noticeDocuments.map((doc, index) => {
                      const inputId = `notice-doc-${index}`;
                      return (
                        <div key={(doc as any)._tempId ?? doc.id ?? index} className="rounded border p-3">
                          <div className="flex gap-3 items-start">
                            <div className="flex-1 space-y-2">
                              <label className="text-sm font-medium">Document Name</label>
                              <input
                                className="w-full rounded border px-3 py-2 text-sm"
                                value={doc.documentName}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNoticeDocuments((prev) => prev.map((d, i) => (i === index ? { ...d, documentName: v } : d)));
                                }}
                                placeholder="e.g. Circular, Attachment"
                              />
                            </div>
                            <button
                              type="button"
                              className="text-sm text-red-600 hover:underline"
                              onClick={() => setNoticeDocuments((prev) => prev.filter((_, i) => i !== index))}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-3 space-y-1">
                            <label className="text-sm font-medium">File</label>
                            <div>
                              <label htmlFor={inputId} className="inline-flex items-center gap-2 rounded border border-dashed px-3 py-2 text-sm cursor-pointer">
                                <span>Choose File</span>
                              </label>
                              <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setNoticeDocuments((prev) => prev.map((d, i) => (i === index ? { ...d, documentUrl: file } : d)));
                                }}
                              />
                            </div>
                            {typeof doc.documentUrl === 'string' && doc.documentUrl && (
                              <div className="text-xs">
                                <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View existing</a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <AppButton type="button" variant="secondary" onClick={() => setNoticeDocuments((prev) => ([...prev, { id: -Date.now(), documentName: '', documentUrl: null, _tempId: -Date.now() }]))}>
                      Add Document
                    </AppButton>
                  </div>
                </div>
              </FormRow>
              <FormRow>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Attachment
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <div className="mx-auto h-12 w-12 text-gray-400">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          <span>
                            {uploading ? "Uploading..." : "Choose File"}
                          </span>
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        PDF, DOC, DOCX, PNG, JPG up to 20MB
                      </p>
                    </div>
                  </div>
                  {uploadedFileUrl && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="ml-2 text-sm text-green-800">
                          File uploaded successfully
                        </span>
                        <a
                          href={uploadedFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-sm text-blue-600 hover:text-blue-500"
                        >
                          View File
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer>
            <div className="flex gap-2">
              <AppButton
                type="button"
                variant="secondary"
                onClick={backWithScrollRestore}
                disabled={submitting}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                isLoading={submitting}
                disabled={uploading}
              >
                {uploading
                  ? "Uploading..."
                  : mode === "create"
                  ? "Save"
                  : "Update"}
              </AppButton>
            </div>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default NoticeForm;
