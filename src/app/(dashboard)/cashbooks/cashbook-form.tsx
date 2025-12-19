"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { apiUpload } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { formatDateForInput } from "@/lib/locales";
import { Plus, Trash2, File, X, Eye } from "lucide-react";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import type { SitesResponse } from "@/types/sites";
import type {
  CreateCashbookRequest,
  Cashbook,
  CashbookDetail,
} from "@/types/cashbooks";

// Temporary type until proper boqs types are created
interface Boq {
  id: number;
  boqNo?: string;
  workOrderNo?: string;
}

interface BoqsResponse {
  data: Boq[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CashbookFormInitialData {
  id?: number;
  voucherNo?: string | null;
  voucherDate?: string;
  siteId?: number | null;
  boqId?: number | null;
  attachVoucherCopyUrl?: string | null;
  cashbookDetails?: CashbookDetail[];
}

export interface CashbookFormProps {
  mode: "create" | "edit";
  initial?: CashbookFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/cashbooks'
}

const cashbookDetailSchema = z.object({
  cashbookHeadId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Cashbook head is required"
    )
    .transform((val) => parseInt(val)),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  openingBalance: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (!val || val === "" || val === "0") return null;
      return typeof val === "string" ? parseFloat(val) || null : val;
    })
    .nullable(),
  closingBalance: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (!val || val === "" || val === "0") return null;
      return typeof val === "string" ? parseFloat(val) || null : val;
    })
    .nullable(),
  amountReceived: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (!val || val === "" || val === "0") return null;
      return typeof val === "string" ? parseFloat(val) || null : val;
    })
    .nullable(),
  amountPaid: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (!val || val === "" || val === "0") return null;
      return typeof val === "string" ? parseFloat(val) || null : val;
    })
    .nullable(),
  documentUrl: z.string().optional(),
});

const createInputSchema = z.object({
  voucherDate: z.string().min(1, "Voucher date is required"),
  siteId: z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "__none" || val === "") return null;
      return typeof val === "string" ? parseInt(val) : val;
    }),
  boqId: z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "__none" || val === "") return null;
      return typeof val === "string" ? parseInt(val) : val;
    }),
  attachVoucherCopyUrl: z.string().optional(),
  cashbookDetails: z
    .array(cashbookDetailSchema)
    .min(1, "At least one cashbook detail is required"),
});

// Use the raw input type before Zod transformation for the form
type FormData = {
  voucherDate: string;
  siteId?: string | number;
  boqId?: string | number;
  attachVoucherCopyUrl?: string;
  cashbookDetails: {
    cashbookHeadId: string | number;
    date: string;
    description?: string;
    openingBalance?: string | number | null;
    closingBalance?: string | number | null;
    amountReceived?: string | number | null;
    amountPaid?: string | number | null;
    documentUrl?: string;
  }[];
};

export function CashbookForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/cashbooks",
}: CashbookFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreview, setFilePreview] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileObjectUrlRef = useRef<string | null>(null);
  const [detailFilePreviews, setDetailFilePreviews] = useState<
    Record<
      string,
      {
        url: string;
        type: "image" | "document";
        name: string;
      } | null
    >
  >({});
  const [detailFileUploads, setDetailFileUploads] = useState<
    Record<string, File | null>
  >({});
  const detailFileInputRefs = useRef<Record<string, HTMLInputElement | null>>(
    {}
  );
  const { backWithScrollRestore } = useScrollRestoration("cashbooks-list");

  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema),
    defaultValues: {
      voucherDate: initial?.voucherDate
        ? formatDateForInput(initial.voucherDate)
        : formatDateForInput(new Date().toISOString()),
      siteId: initial?.siteId ? String(initial.siteId) : "__none",
      boqId: initial?.boqId ? String(initial.boqId) : "__none",
      attachVoucherCopyUrl: initial?.attachVoucherCopyUrl || "",
      cashbookDetails: initial?.cashbookDetails?.map((detail) => ({
        cashbookHeadId: detail.cashbookHeadId
          ? String(detail.cashbookHeadId)
          : "__none",
        date: detail.date
          ? formatDateForInput(detail.date)
          : formatDateForInput(new Date().toISOString()),
        description: detail.description || "",
        openingBalance: detail.openingBalance || "",
        closingBalance: detail.closingBalance || "",
        amountReceived: detail.amountReceived || "",
        amountPaid: detail.amountPaid || "",
        documentUrl: detail.documentUrl || "",
      })) || [
        {
          cashbookHeadId: "__none",
          date: formatDateForInput(new Date().toISOString()),
          description: "",
          openingBalance: "",
          closingBalance: "",
          amountReceived: "",
          amountPaid: "",
          documentUrl: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "cashbookDetails",
  });

  // Auto-calc closingBalance = openingBalance + amountReceived - amountPaid
  useEffect(() => {
    const subscription = form.watch((_, info) => {
      const name = info?.name || "";
      if (!name.startsWith("cashbookDetails.")) return;
      const match = name.match(
        /^cashbookDetails\.(\d+)\.(openingBalance|amountReceived|amountPaid)$/
      );
      if (!match) return;
      const idx = parseInt(match[1]);
      const ob =
        Number(
          form.getValues(`cashbookDetails.${idx}.openingBalance` as const) ?? 0
        ) || 0;
      const ar =
        Number(
          form.getValues(`cashbookDetails.${idx}.amountReceived` as const) ?? 0
        ) || 0;
      const ap =
        Number(
          form.getValues(`cashbookDetails.${idx}.amountPaid` as const) ?? 0
        ) || 0;
      const computed = ob + ar - ap;
      const nextVal = String(Number.isFinite(computed) ? computed : 0);
      const current = form.getValues(
        `cashbookDetails.${idx}.closingBalance` as const
      );
      if (String(current ?? "") !== nextVal) {
        form.setValue(
          `cashbookDetails.${idx}.closingBalance` as const,
          nextVal,
          { shouldValidate: false, shouldDirty: true }
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Fetch sites, BOQs, and cashbook heads for dropdowns
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );
  // Filter BOQs by selected site
  const selectedSiteId = form.watch("siteId");
  const resolvedSiteId =
    typeof selectedSiteId === "string"
      ? selectedSiteId && selectedSiteId !== "__none" && selectedSiteId !== ""
        ? Number(selectedSiteId)
        : undefined
      : selectedSiteId;
  const boqsKey = resolvedSiteId
    ? `/api/boqs?perPage=100&siteId=${resolvedSiteId}`
    : null;
  const { data: boqsData } = useSWR<BoqsResponse>(boqsKey, apiGet);
  const { data: cashbookHeadsData } = useSWR<{ data: any[] }>(
    "/api/cashbook-heads?perPage=100",
    apiGet
  );

  // Reset BOQ when Site changes (prevents cross-site selections)
  const prevSiteIdRef = useRef<string | number | undefined>(
    form.getValues("siteId")
  );
  useEffect(() => {
    const curr = form.getValues("siteId");
    if (prevSiteIdRef.current !== curr) {
      prevSiteIdRef.current = curr as any;
      // Clear BOQ selection on site change
      form.setValue("boqId", "__none", { shouldDirty: true, shouldValidate: true });
    }
  }, [selectedSiteId, form]);

  // Build selected head IDs to avoid duplicates across rows
  const getSelectedHeadIds = () => {
    const details = form.getValues("cashbookDetails") || [];
    const ids = (details as any[]).map((d) => {
      const v =
        typeof d?.cashbookHeadId === "string"
          ? parseInt(d.cashbookHeadId)
          : d?.cashbookHeadId;
      return Number.isFinite(v) ? Number(v) : 0;
    });
    return new Set(ids.filter((n: number) => n > 0));
  };

  // For a row, keep its current value visible, hide heads picked in other rows
  const getAvailableHeadsForRow = (currentValue: string | number) => {
    const selected = getSelectedHeadIds();
    const curr =
      typeof currentValue === "string" ? parseInt(currentValue) : currentValue;
    return (cashbookHeadsData?.data || []).filter(
      (h: any) => h.id === curr || !selected.has(h.id)
    );
  };

  // Initialize file preview for existing file when editing
  useEffect(() => {
    if (initial?.attachVoucherCopyUrl && mode === "edit") {
      const fileUrl = initial.attachVoucherCopyUrl;
      const fileName = fileUrl.split("/").pop() || "Attached File";
      const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
      const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(
        fileExtension
      );

      setFilePreview({
        url: fileUrl,
        type: isImage ? "image" : "document",
        name: fileName,
      });
    } else if (!currentFile && !currentFileObjectUrlRef.current) {
      setFilePreview(null);
    }
  }, [initial?.attachVoucherCopyUrl, mode, currentFile]);

  // File handling functions
  const handleFileSelect = (file: File, onChange: (value: string) => void) => {
    if (currentFileObjectUrlRef.current) {
      URL.revokeObjectURL(currentFileObjectUrlRef.current);
      currentFileObjectUrlRef.current = null;
    }

    setCurrentFile(file);

    const isImage = file.type.startsWith("image/");

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const { result } = reader;
        if (typeof result === "string") {
          setFilePreview({
            url: result,
            type: "image",
            name: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      const objectUrl = URL.createObjectURL(file);
      currentFileObjectUrlRef.current = objectUrl;
      setFilePreview({
        url: objectUrl,
        type: "document",
        name: file.name,
      });
    }

    onChange(file.name);
  };

  const removeFile = (onChange: (value: string) => void) => {
    if (currentFileObjectUrlRef.current) {
      URL.revokeObjectURL(currentFileObjectUrlRef.current);
      currentFileObjectUrlRef.current = null;
    }
    setCurrentFile(null);
    setFilePreview(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (currentFileObjectUrlRef.current) {
        URL.revokeObjectURL(currentFileObjectUrlRef.current);
        currentFileObjectUrlRef.current = null;
      }
    };
  }, []);

  const isImageFile = (filename: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "");
  };

  // Reset form values when initial data changes
  useEffect(() => {
    if (initial && mode === "edit") {
      form.reset({
        voucherDate: initial.voucherDate
          ? formatDateForInput(initial.voucherDate)
          : formatDateForInput(new Date().toISOString()),
        siteId: initial.siteId ? String(initial.siteId) : "__none",
        boqId: initial.boqId ? String(initial.boqId) : "__none",
        attachVoucherCopyUrl: initial.attachVoucherCopyUrl || "",
        cashbookDetails: initial.cashbookDetails?.map((detail) => ({
          cashbookHeadId: detail.cashbookHeadId
            ? String(detail.cashbookHeadId)
            : "__none",
          date: detail.date
            ? formatDateForInput(detail.date)
            : formatDateForInput(new Date().toISOString()),
          description: detail.description || "",
          openingBalance: detail.openingBalance || "",
          closingBalance: detail.closingBalance || "",
          amountReceived: detail.amountReceived || "",
          amountPaid: detail.amountPaid || "",
          documentUrl: detail.documentUrl || "",
        })) || [
          {
            cashbookHeadId: "__none",
            date: formatDateForInput(new Date().toISOString()),
            description: "",
            openingBalance: "",
            closingBalance: "",
            amountReceived: "",
            amountPaid: "",
            documentUrl: "",
          },
        ],
      });
    }
  }, [initial, mode, form]);

  const addDetail = () => {
    append({
      cashbookHeadId: "__none",
      date: formatDateForInput(new Date().toISOString()),
      description: "",
      openingBalance: "",
      closingBalance: "",
      amountReceived: "",
      amountPaid: "",
      documentUrl: "",
    });
  };

  const removeDetail = (index: number) => {
    if (fields.length > 1) {
      const fieldId = fields[index]?.id;
      if (fieldId) {
        setDetailFilePreviews((prev) => {
          const updated = { ...prev };
          delete updated[fieldId];
          return updated;
        });
        setDetailFileUploads((prev) => {
          const updated = { ...prev };
          delete updated[fieldId];
          return updated;
        });
        const inputRef = detailFileInputRefs.current[fieldId];
        if (inputRef) {
          inputRef.value = "";
        }
      }
      remove(index);
    }
  };

  const handleDetailFileSelect = (
    file: File,
    onChange: (value: string) => void,
    fieldId: string
  ) => {
    const isImage = file.type.startsWith("image/");

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const { result } = reader;
        if (typeof result === "string") {
          setDetailFilePreviews((prev) => ({
            ...prev,
            [fieldId]: {
              url: result,
              type: "image",
              name: file.name,
            },
          }));
        }
      };
      reader.readAsDataURL(file);
    } else {
      setDetailFilePreviews((prev) => ({
        ...prev,
        [fieldId]: {
          url: "",
          type: "document",
          name: file.name,
        },
      }));
    }

    setDetailFileUploads((prev) => ({
      ...prev,
      [fieldId]: file,
    }));
    onChange(file.name);
  };

  const removeDetailFile = (
    fieldId: string,
    onChange: (value: string) => void
  ) => {
    setDetailFilePreviews((prev) => {
      const updated = { ...prev };
      delete updated[fieldId];
      return updated;
    });
    setDetailFileUploads((prev) => {
      const updated = { ...prev };
      delete updated[fieldId];
      return updated;
    });
    onChange("");
    const inputRef = detailFileInputRefs.current[fieldId];
    if (inputRef) {
      inputRef.value = "";
    }
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      // Validate and transform using Zod schema
      const transformedData = createInputSchema.parse(values);

      const payload: CreateCashbookRequest = {
        voucherDate: transformedData.voucherDate,
        siteId: transformedData.siteId,
        boqId: transformedData.boqId,
        attachVoucherCopyUrl: transformedData.attachVoucherCopyUrl || null,
        cashbookDetails: transformedData.cashbookDetails.map((detail) => ({
          cashbookHeadId: detail.cashbookHeadId,
          date: detail.date,
          description: detail.description || null,
          openingBalance: detail.openingBalance,
          closingBalance: detail.closingBalance,
          amountReceived: detail.amountReceived,
          amountPaid: detail.amountPaid,
          documentUrl: detail.documentUrl || null,
        })),
      };

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));

      if (currentFile) {
        formData.append("attachVoucherCopy", currentFile);
      }

      transformedData.cashbookDetails.forEach((_, index) => {
        const fieldId = fields[index]?.id;
        if (!fieldId) return;
        const file = detailFileUploads[fieldId];
        if (file) {
          formData.append(`detailDocument[${index}]`, file);
        }
      });

      let result;
      if (mode === "create") {
        result = await apiUpload("/api/cashbooks", formData);
        toast.success("Cashbook created successfully");
      } else {
        result = await apiUpload(`/api/cashbooks/${initial?.id}`, formData, {
          method: "PATCH",
        });
        toast.success("Cashbook updated successfully");
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode} cashbook`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Render cashbook details table
  const renderDetailsTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium text-sm">Date *</th>
            <th className="text-left p-2 font-medium text-sm">
              Cashbook Head *
            </th>
            <th className="text-left p-2 font-medium text-sm">
              Opening Balance
            </th>
            <th className="text-left p-2 font-medium text-sm">
              Amount Received
            </th>
            <th className="text-left p-2 font-medium text-sm">Amount Paid</th>
            <th className="text-left p-2 font-medium text-sm">
              Closing Balance
            </th>
            <th className="text-center p-2 font-medium text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((detailField, index) => (
            <Fragment key={detailField.id}>
              <tr className="border-t">
                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.date`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input {...field} type="date" className="text-sm" />
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.cashbookHeadId`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <AppSelect
                            value={String(field.value || "__none")}
                            onValueChange={async (val) => {
                              field.onChange(val);
                              // After selecting head, try to fetch last closing balance and set as opening balance
                              try {
                                const siteVal = form.getValues("siteId") as
                                  | string
                                  | number
                                  | undefined
                                  | null;
                                const boqVal = form.getValues("boqId") as
                                  | string
                                  | number
                                  | undefined
                                  | null;
                                const siteId =
                                  siteVal &&
                                  siteVal !== "__none" &&
                                  siteVal !== ""
                                    ? Number(siteVal)
                                    : undefined;
                                const boqId =
                                  boqVal && boqVal !== "__none" && boqVal !== ""
                                    ? Number(boqVal)
                                    : undefined;
                                const headId =
                                  val && val !== "__none" && val !== ""
                                    ? Number(val)
                                    : undefined;
                                if (siteId && headId) {
                                  const qs = new URLSearchParams({
                                    siteId: String(siteId),
                                    cashbookHeadId: String(headId),
                                  });
                                  if (boqId) qs.set("boqId", String(boqId));
                                  const res = await apiGet(
                                    `/api/cashbooks/last-balance?${qs.toString()}` as any
                                  );
                                  const closing =
                                    (res as any)?.data?.closingBalance ??
                                    (res as any)?.closingBalance ??
                                    null;
                                  const opening =
                                    closing != null ? String(closing) : "0";
                                  form.setValue(
                                    `cashbookDetails.${index}.openingBalance` as const,
                                    opening,
                                    {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                      shouldTouch: true,
                                    }
                                  );
                                  await form.trigger(
                                    `cashbookDetails.${index}.openingBalance` as const
                                  );
                                  // Also set closing balance immediately based on current received/paid
                                  const arRaw = form.getValues(
                                    `cashbookDetails.${index}.amountReceived` as const
                                  ) as any;
                                  const apRaw = form.getValues(
                                    `cashbookDetails.${index}.amountPaid` as const
                                  ) as any;
                                  const obNum = Number(opening) || 0;
                                  const arNum = Number(arRaw ?? 0) || 0;
                                  const apNum = Number(apRaw ?? 0) || 0;
                                  const closingNow = String(
                                    obNum + arNum - apNum
                                  );
                                  form.setValue(
                                    `cashbookDetails.${index}.closingBalance` as const,
                                    closingNow,
                                    { shouldDirty: true }
                                  );
                                }
                              } catch (e) {
                                // fail-silent for UX; keep opening balance unchanged
                              }
                            }}
                          >
                            <AppSelect.Item value="__none">
                              Select Cashbook Head
                            </AppSelect.Item>
                            {getAvailableHeadsForRow(field.value)?.map(
                              (head: any) => (
                                <AppSelect.Item
                                  key={head.id}
                                  value={head.id.toString()}
                                >
                                  {head.cashbookHeadName}
                                </AppSelect.Item>
                              )
                            )}
                          </AppSelect>
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>

                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.openingBalance`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-sm"
                            disabled
                          />
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.amountReceived`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-sm"
                          />
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.amountPaid`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-sm"
                          />
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2">
                  <FormField
                    control={form.control}
                    name={`cashbookDetails.${index}.closingBalance`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-sm"
                            disabled
                          />
                        </FormControl>
                        <div className="min-h-[16px]">
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 text-center" rowSpan={2}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeDetail(index)}
                    disabled={fields.length <= 1}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="p-3 align-top">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Description
                    </span>
                    <FormField
                      control={form.control}
                      name={`cashbookDetails.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Enter description"
                              className="min-h-[60px] text-sm"
                            />
                          </FormControl>
                          <div className="min-h-[16px]">
                            <FormMessage className="text-xs" />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </td>
                <td colSpan={3} className="p-3 align-top">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Document
                    </span>
                    <FormField
                      control={form.control}
                      name={`cashbookDetails.${index}.documentUrl`}
                      render={({ field }) => {
                        const fieldId = detailField.id;
                        const preview = detailFilePreviews[fieldId] || null;
                        const existingValue = field.value;
                        const hasExistingValue = !!existingValue;
                        return (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <div className="space-y-2">
                                <Input
                                  ref={(element) => {
                                    detailFileInputRefs.current[fieldId] =
                                      element;
                                  }}
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleDetailFileSelect(
                                        file,
                                        field.onChange,
                                        fieldId
                                      );
                                    }
                                  }}
                                  className="file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                                />
                                {(preview || hasExistingValue) && (
                                  <div className="flex items-center gap-2">
                                    {preview?.type === "image" &&
                                    preview.url ? (
                                      <div className="w-12 h-12 border rounded overflow-hidden bg-muted">
                                        <img
                                          src={preview.url}
                                          alt="Document preview"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : null}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {preview?.name ||
                                          (typeof existingValue === "string"
                                            ? existingValue.split("/").pop() ||
                                              existingValue
                                            : "Selected file")}
                                      </p>
                                      {preview?.type === "image" &&
                                        preview.url &&
                                        preview.url === existingValue && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              window.open(preview.url, "_blank")
                                            }
                                            className="h-7 text-xs mt-1"
                                          >
                                            <Eye className="h-3 w-3 mr-1" />
                                            View
                                          </Button>
                                        )}
                                      {!preview && hasExistingValue && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            typeof existingValue === "string"
                                              ? window.open(
                                                  existingValue,
                                                  "_blank"
                                                )
                                              : undefined
                                          }
                                          className="h-7 text-xs mt-1"
                                          disabled={
                                            typeof existingValue !== "string"
                                          }
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          View
                                        </Button>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        removeDetailFile(
                                          fieldId,
                                          field.onChange
                                        )
                                      }
                                      className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <div className="min-h-[16px]">
                              <FormMessage className="text-xs" />
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="p-3 border-t bg-muted/25">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDetail}
          className="gap-2 h-8"
        >
          <Plus className="h-3 w-3" />
          <span className="text-sm">Add Detail</span>
        </Button>
      </div>
    </div>
  );

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          {mode === "create" ? "Create Cashbook" : "Edit Cashbook"}
        </AppCard.Title>
        <AppCard.Description>
          {mode === "create"
            ? "Create a new cashbook voucher with details."
            : "Update cashbook voucher information."}
        </AppCard.Description>
      </AppCard.Header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AppCard.Content className="space-y-6">
            {/* Header Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Header Section</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Voucher No (readonly for edit, placeholder for create) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voucher No</label>
                  <Input
                    value={initial?.voucherNo || "<New Code>"}
                    disabled
                    className="bg-muted"
                  />
                </div>

                {/* Voucher Date */}
                <FormField
                  control={form.control}
                  name="voucherDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voucher Date *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Site */}
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <FormControl>
                        <AppSelect
                          value={String(field.value || "__none")}
                          onValueChange={field.onChange}
                        >
                          <AppSelect.Item value="__none">
                            Select Site
                          </AppSelect.Item>
                          {sitesData?.data?.map((site) => (
                            <AppSelect.Item
                              key={site.id}
                              value={site.id.toString()}
                            >
                              {site.site}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Bill of Quantity */}
                <FormField
                  control={form.control}
                  name="boqId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill of Quantity</FormLabel>
                      <FormControl>
                        <AppSelect
                          value={String(field.value || "__none")}
                          onValueChange={field.onChange}
                        >
                          <AppSelect.Item value="__none">
                            Select BOQ
                          </AppSelect.Item>
                          {boqsData?.data?.map((boq) => (
                            <AppSelect.Item
                              key={boq.id}
                              value={boq.id.toString()}
                            >
                              {boq.boqNo && boq.workOrderNo
                                ? `${boq.boqNo} - ${boq.workOrderNo}`
                                : boq.boqNo ||
                                  boq.workOrderNo ||
                                  `BOQ ${boq.id}`}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Attach Voucher Copy */}
              <FormField
                control={form.control}
                name="attachVoucherCopyUrl"
                render={({ field: { onChange, name, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Attach Supporting File</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {/* File Input */}
                        <div className="flex items-center gap-2">
                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileSelect(file, onChange);
                              }
                            }}
                            name={name}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                          />
                          {filePreview && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFile(onChange)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* File Preview */}
                        {filePreview && (
                          <div className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-start gap-3">
                              {filePreview.type === "image" ? (
                                <div className="flex-shrink-0">
                                  <div className="w-24 h-24 border rounded overflow-hidden bg-muted">
                                    <img
                                      src={filePreview.url}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // If image fails to load, show file icon instead
                                        const target =
                                          e.target as HTMLImageElement;
                                        target.style.display = "none";
                                        target.parentElement!.innerHTML =
                                          '<div class="w-full h-full flex items-center justify-center"><svg class="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-24 h-24 border rounded flex items-center justify-center bg-muted">
                                  <File className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {filePreview.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {filePreview.type === "image"
                                    ? "Image file"
                                    : "Document file"}
                                </p>

                                {filePreview.url && (
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open(filePreview.url, "_blank")
                                      }
                                      className="h-7 text-xs"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View File
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Upload hint */}
                        {!filePreview && (
                          <p className="text-xs text-muted-foreground">
                            Supported formats include images, PDF, Word, Excel,
                            PowerPoint, text, CSV, and similar documents (Max
                            20MB)
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dynamic Cashbook Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cashbook Details</h3>
              {renderDetailsTable()}
            </div>
          </AppCard.Content>

          <AppCard.Footer className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => backWithScrollRestore()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <AppButton type="submit" isLoading={isSubmitting}>
              {mode === "create" ? "Create Cashbook" : "Update Cashbook"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </Form>
    </AppCard>
  );
}
