"use client";

import { useState } from "react";
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "document");
      formData.append("prefix", "notice");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setUploadedFileUrl(result.url);
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        noticeHead: values.noticeDate,
        noticeHeading: values.noticeHeading,
        noticeDescription: values.notice,
        documentUrl: uploadedFileUrl,
      };

      if (mode === "create") {
        await apiPost("/api/notices", payload);
        toast.success("Notice created successfully");
      } else {
        await apiPatch(`/api/notices/${initial?.id}`, payload);
        toast.success("Notice updated successfully");
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
