"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { formatDateForInput } from "@/lib/locales";
import useSWR from "swr";
import { RENT_DAY_OPTIONS } from "@/types/rents";
import { UploadInput } from "@/components/common/upload-input";
import { documentUploadConfig } from "@/lib/upload-config";
import { RentDocumentUploadArray } from "./rent-document-array";

interface SitesResponse {
  data: Array<{ id: number; site: string }>;
}

interface RentalCategoriesResponse {
  data: Array<{ id: number; rentalCategory: string }>;
}

interface RentTypesResponse {
  data: Array<{ id: number; rentType: string }>;
}

interface BoqsResponse {
  data: Array<{
    id: number;
    boqNo: string;
    siteId?: number | null;
    workName?: string | null;
  }>;
}

export interface RentFormProps {
  mode: "create" | "edit";
  initial?: any;
  onSuccess?: (result?: unknown) => void;
}

export function RentForm({ mode, initial, onSuccess }: RentFormProps) {
  const { backWithScrollRestore } = useScrollRestoration("rents-list");
  const [submitting, setSubmitting] = useState(false);

  // Schema for documents
  const documentSchema = z.object({
    id: z.number().optional(),
    documentName: z.string().min(1, "Document name is required"),
    documentUrl: z
      .any()
      .refine(
        (val) =>
          (typeof val === "string" && val.trim() !== "") || val instanceof File,
        "Document file is required"
      ),
  });

  // Different schemas for add vs edit modes
  const addSchema = z.object({
    siteId: z
      .number({ required_error: "Site is required" })
      .min(1, "Site is required"),
    boqId: z
      .number({ required_error: "Bill of Quantity is required" })
      .min(1, "Bill of Quantity is required"),
    rentalCategoryId: z
      .number({ required_error: "Rent Category is required" })
      .min(1, "Rent Category is required"),
    rentTypeId: z
      .number({ required_error: "Rent Type is required" })
      .min(1, "Rent Type is required"),
    owner: z.string().min(1, "Owner is required"),
    pancardNo: z.string().optional(),
    rentDay: z.string().min(1, "Rent Day is required"),
    fromDate: z.string().min(1, "From Date is required"),
    toDate: z.string().min(1, "To Date is required"),
    description: z.string().optional(),
    depositAmount: z.preprocess((val) => {
      if (val === "" || val == null) return undefined;
      return Number(val);
    }, z.number({ required_error: "Deposit Amount is required" }).min(0, "Deposit Amount must be 0 or greater")),
    rentAmount: z.preprocess((val) => {
      if (val === "" || val == null) return undefined;
      return Number(val);
    }, z.number({ required_error: "Rent Amount is required" }).min(0, "Rent Amount must be 0 or greater")),
    bank: z.string().optional(),
    branch: z.string().optional(),
    accountNo: z.string().optional(),
    accountName: z.string().optional(),
    ifscCode: z.string().optional(),
    momCopy: z
      .any()
      .refine((val) => !val || val instanceof File, "Invalid file input")
      .optional(),
    rentDocuments: z.array(documentSchema).default([]),
  });

  const editSchema = z.object({
    siteId: z
      .number({ required_error: "Site is required" })
      .min(1, "Site is required"),
    boqId: z
      .number({ required_error: "Bill of Quantity is required" })
      .min(1, "Bill of Quantity is required"),
    rentalCategoryId: z
      .number({ required_error: "Rent Category is required" })
      .min(1, "Rent Category is required"),
    rentTypeId: z
      .number({ required_error: "Rent Type is required" })
      .min(1, "Rent Type is required"),
    owner: z.string().min(1, "Owner is required"),
    pancardNo: z.string().optional(),
    dueDate: z.string().min(1, "Due Date is required"),
    description: z.string().optional(),
    depositAmount: z.preprocess((val) => {
      if (val === "" || val == null) return undefined;
      return Number(val);
    }, z.number({ required_error: "Deposit Amount is required" }).min(0, "Deposit Amount must be 0 or greater")),
    rentAmount: z.preprocess((val) => {
      if (val === "" || val == null) return undefined;
      return Number(val);
    }, z.number({ required_error: "Rent Amount is required" }).min(0, "Rent Amount must be 0 or greater")),
    bank: z.string().optional(),
    branch: z.string().optional(),
    accountNo: z.string().optional(),
    accountName: z.string().optional(),
    ifscCode: z.string().optional(),
  });

  const schema = mode === "create" ? addSchema : editSchema;

  // Different default values for add vs edit modes
  const getDefaultValues = () => {
    const baseDefaults = {
      siteId: initial?.siteId ?? null,
      boqId: initial?.boqId ?? null,
      rentalCategoryId: initial?.rentalCategoryId ?? null,
      rentTypeId: initial?.rentTypeId ?? null,
      owner: initial?.owner ?? "",
      pancardNo: initial?.pancardNo ?? "",
      description: initial?.description ?? "",
      depositAmount: initial?.depositAmount ?? "",
      rentAmount: initial?.rentAmount ?? "",
      bank: initial?.bank ?? "",
      branch: initial?.branch ?? "",
      accountNo: initial?.accountNo ?? "",
      accountName: initial?.accountName ?? "",
      ifscCode: initial?.ifscCode ?? "",
    };

    const initialDocumentValues =
      initial?.rentDocuments?.map((doc: any) => ({
        id: doc.id,
        documentName: doc.documentName || "",
        documentUrl: doc.documentUrl || "",
        _isNew: false,
      })) || [];

    if (mode === "create") {
      return {
        ...baseDefaults,
        momCopy: null,
        rentDay: initial?.rentDay ?? "",
        fromDate: initial?.fromDate
          ? formatDateForInput(new Date(initial.fromDate))
          : "",
        toDate: initial?.toDate
          ? formatDateForInput(new Date(initial.toDate))
          : "",
        rentDocuments: initialDocumentValues,
      };
    } else {
      return {
        ...baseDefaults,
        dueDate: initial?.dueDate
          ? formatDateForInput(new Date(initial.dueDate))
          : "",
      };
    }
  };

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues() as any,
  });

  const { control, handleSubmit, watch, setValue } = form;
  const selectedSiteId = watch("siteId");

  // Fetch dropdown data
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );
  const { data: categoriesData } = useSWR<RentalCategoriesResponse>(
    "/api/rental-categories?perPage=100",
    apiGet
  );
  const { data: typesData } = useSWR<RentTypesResponse>(
    "/api/rent-types?perPage=100",
    apiGet
  );
  const { data: boqsData } = useSWR<BoqsResponse>(
    "/api/boqs?perPage=100",
    apiGet
  );

  async function onSubmit(data: any) {
    setSubmitting(true);
    try {
      // Always use multipart FormData to support documents and optional files
      const fd = new FormData();

      // Build document metadata and attach files
      const documents = (data.rentDocuments || []) as Array<any>;
      const documentMetadata = documents
        .map((doc) => {
          const isExistingDoc = typeof doc.id === "number" && doc.id > 0;
          const metadata: any = {
            documentName: doc.documentName || "",
            documentUrl: (() => {
              if (doc.documentUrl instanceof File) return doc.documentUrl;
              return typeof doc.documentUrl === "string" &&
                doc.documentUrl.trim() !== ""
                ? doc.documentUrl
                : undefined;
            })(),
          };
          if (isExistingDoc) metadata.id = doc.id;
          else if (doc._isNew && doc._tempId) metadata._tempId = doc._tempId;
          return metadata;
        })
        .filter((doc) => doc.documentName && doc.documentUrl);

      // Append primitive fields
      if (data.owner) fd.append("owner", data.owner.trim());
      if (data.pancardNo) fd.append("pancardNo", data.pancardNo.trim());
      if (data.description) fd.append("description", data.description.trim());
      if (data.bank) fd.append("bank", data.bank.trim());
      if (data.branch) fd.append("branch", data.branch.trim());
      if (data.accountNo) fd.append("accountNo", data.accountNo.trim());
      if (data.accountName) fd.append("accountName", data.accountName.trim());
      if (data.ifscCode) fd.append("ifscCode", data.ifscCode.trim());
      if (data.siteId) fd.append("siteId", String(data.siteId));
      if (data.boqId) fd.append("boqId", String(data.boqId));
      if (data.rentalCategoryId)
        fd.append("rentalCategoryId", String(data.rentalCategoryId));
      if (data.rentTypeId) fd.append("rentTypeId", String(data.rentTypeId));

      if (mode === "create") {
        if (data.rentDay) fd.append("rentDay", data.rentDay);
        if (data.fromDate) fd.append("fromDate", data.fromDate);
        if (data.toDate) fd.append("toDate", data.toDate);
        if (data.depositAmount !== undefined && data.depositAmount !== null)
          fd.append("depositAmount", String(data.depositAmount));
        if (data.rentAmount !== undefined && data.rentAmount !== null)
          fd.append("rentAmount", String(data.rentAmount));
        if (data.momCopy) fd.append("momCopy", data.momCopy);
      } else {
        if (data.dueDate) fd.append("dueDate", data.dueDate);
        if (data.depositAmount !== undefined && data.depositAmount !== null)
          fd.append("depositAmount", String(data.depositAmount));
        if (data.rentAmount !== undefined && data.rentAmount !== null)
          fd.append("rentAmount", String(data.rentAmount));
      }

      // Documents only in create mode
      if (mode === "create") {
        fd.append("rentDocuments", JSON.stringify(documentMetadata));
        documents.forEach((doc, idx) => {
          if (doc?.documentUrl instanceof File) {
            fd.append(
              `rentDocuments[${idx}][documentFile]`,
              doc.documentUrl,
              doc.documentUrl.name
            );
          }
        });
      }

      // Submit
      let resp: Response;
      if (mode === "create") {
        resp = await fetch("/api/rents", { method: "POST", body: fd });
      } else {
        resp = await fetch(`/api/rents/${initial?.id}`, {
          method: "PATCH",
          body: fd,
        });
      }
      const result = await resp.json().catch(() => null);
      if (!resp.ok)
        throw new Error(
          result?.message ||
            `Failed to ${mode === "create" ? "create" : "update"} rent`
        );

      // Success notifications
      if (
        mode === "create" &&
        result &&
        typeof result === "object" &&
        "message" in result &&
        "data" in result
      ) {
        toast.success(result.message as string);
      } else {
        toast.success(
          `Rent ${mode === "create" ? "created" : "updated"} successfully`
        );
      }

      if (onSuccess) onSuccess(result);
      else backWithScrollRestore();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          {mode === "create" ? "Add New Rent" : "Edit Rent"}
        </AppCard.Title>
      </AppCard.Header>
      <AppCard.Content>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection legend="Basic Details">
              <FormRow cols={2} from="md">
                <TextInput
                  control={control}
                  name="owner"
                  label="Owner"
                  required
                  placeholder="Enter owner name"
                />
                <TextInput
                  control={control}
                  name="pancardNo"
                  label="PAN Card No"
                  placeholder="Enter PAN card number"
                />
              </FormRow>
              <FormRow cols={2} from="md">
                <FormField
                  control={control}
                  name="siteId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        Site <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) =>
                            field.onChange(v ? parseInt(v) : null)
                          }
                          placeholder="Select a site"
                        >
                          {sitesData?.data?.map((s: any) => (
                            <AppSelect.Item key={s.id} value={String(s.id)}>
                              {s.site}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="boqId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        Bill Of Quantity <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) =>
                            field.onChange(v ? parseInt(v) : null)
                          }
                          disabled={!selectedSiteId}
                          placeholder="Select BOQ"
                        >
                          {boqsData?.data
                            ?.filter(
                              (b: any) =>
                                !selectedSiteId || b.siteId === selectedSiteId
                            )
                            .map((b: any) => (
                              <AppSelect.Item key={b.id} value={String(b.id)}>
                                {b.boqNo}
                                {b.workName ? ` - ${b.workName}` : ""}
                              </AppSelect.Item>
                            ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="rentalCategoryId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        Rent Category <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) =>
                            field.onChange(v ? parseInt(v) : null)
                          }
                          placeholder="Select rent category"
                        >
                          {categoriesData?.data?.map((c: any) => (
                            <AppSelect.Item key={c.id} value={String(c.id)}>
                              {c.rentalCategory}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="rentTypeId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        Rent Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) =>
                            field.onChange(v ? parseInt(v) : null)
                          }
                          placeholder="Select rent type"
                        >
                          {typesData?.data?.map((t: any) => (
                            <AppSelect.Item key={t.id} value={String(t.id)}>
                              {t.rentType}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
              {mode === "create" ? (
                // Add Mode: Show rentDay, fromDate, toDate
                <>
                  <FormRow cols={3} from="md">
                    <FormField
                      control={control}
                      name="rentDay"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>
                            Rent Day <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <AppSelect
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              placeholder="Select rent day"
                            >
                              {RENT_DAY_OPTIONS.map((option) => (
                                <AppSelect.Item
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </AppSelect.Item>
                              ))}
                            </AppSelect>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="fromDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            From Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="toDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            To Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FormRow>
                  <FormRow cols={2} from="md">
                    <TextInput
                      control={control}
                      name="depositAmount"
                      label="Deposit Amount"
                      required
                      type="number"
                      placeholder="Enter deposit amount"
                    />
                    <TextInput
                      control={control}
                      name="rentAmount"
                      label="Rent Amount"
                      required
                      type="number"
                      placeholder="Enter rent amount"
                    />
                  </FormRow>
                </>
              ) : (
                // Edit Mode: Show dueDate, deposit and rent amounts
                <>
                  <FormRow cols={3} from="md">
                    <TextInput
                      control={control}
                      name="depositAmount"
                      label="Deposit Amount"
                      required
                      type="number"
                      placeholder="Enter deposit amount"
                    />
                    <TextInput
                      control={control}
                      name="rentAmount"
                      label="Rent Amount"
                      required
                      type="number"
                      placeholder="Enter rent amount"
                    />
                    <FormField
                      control={control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Due Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FormRow>
                </>
              )}
              <FormRow cols={1} from="md">
                <TextInput
                  control={control}
                  name="description"
                  label="Description"
                  placeholder="Enter description"
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Bank Details">
              <FormRow cols={5} from="md">
                <TextInput
                  control={control}
                  name="bank"
                  label="Bank"
                  placeholder="Enter bank name"
                />
                <TextInput
                  control={control}
                  name="branch"
                  label="Branch"
                  placeholder="Enter branch name"
                />
                <TextInput
                  control={control}
                  name="accountNo"
                  label="Account No"
                  placeholder="Enter account number"
                />
                <TextInput
                  control={control}
                  name="accountName"
                  label="Account Name"
                  placeholder="Enter account holder name"
                />
                <TextInput
                  control={control}
                  name="ifscCode"
                  label="IFSC Code"
                  placeholder="Enter IFSC code"
                />
              </FormRow>
            </FormSection>

            {mode === "create" && (
              <FormSection legend="File Upload">
                <FormRow cols={1} from="md">
                  <UploadInput
                    control={control}
                    name="momCopy"
                    label="MOM Copy"
                    description="Upload Minutes of Meeting copy (PDF, DOC, etc.)"
                    accept=".pdf,.doc,.docx,.txt"
                    maxSizeBytes={documentUploadConfig.maxSize}
                    existingUrl={
                      initial?.momCopyUrl
                        ? `/api/documents/${initial.momCopyUrl}`
                        : null
                    }
                    showPreview={false}
                  />
                </FormRow>
              </FormSection>
            )}

            {mode === "create" && (
              <FormSection legend="Documents">
                <RentDocumentUploadArray control={control} />
              </FormSection>
            )}

            <div className="flex gap-2 justify-end">
              <AppButton
                type="button"
                variant="outline"
                onClick={backWithScrollRestore}
              >
                Cancel
              </AppButton>
              <AppButton type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : mode === "create"
                  ? "Create"
                  : "Update"}
              </AppButton>
            </div>
          </form>
        </Form>
      </AppCard.Content>
    </AppCard>
  );
}
