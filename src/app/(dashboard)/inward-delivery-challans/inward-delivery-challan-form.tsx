"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppSelect } from "@/components/common/app-select";
import { apiPost, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Upload, FileText, Trash2 } from "lucide-react";

export interface InwardDeliveryChallanFormInitialData {
  id?: number;
  purchaseOrderId?: number | null;
  vendorId?: number | null;
  siteId?: number | null;
  inwardChallanNo?: string | null;
  inwardChallanDate?: string | null;
  challanNo?: string | null;
  challanDate?: string | null;
  lrNo?: string | null;
  lRDate?: string | null;

  billNo?: string | null;
  billDate?: string | null;
  vehicleNo?: string | null;
  remarks?: string | null;

  items?: Array<{
    poDetailsId?: number | null;
    receivingQty?: string | number | null;
    rate?: string | number | null;
    amount?: string | number | null;
  }> | null;
}

export interface InwardDeliveryChallanFormProps {
  initial?: InwardDeliveryChallanFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/inward-delivery-challans'
}

const baseSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase Order is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  siteId: z.string().min(1, "Site is required"),
  inwardChallanDate: z.string().min(1, "Inward Challan Date is required"),
  challanNo: z.string().min(1, "Challan No is required"),
  challanDate: z.string().min(1, "Challan Date is required"),
  lrNo: z.string().optional(),
  lRDate: z.string().optional(),
  billNo: z.string().optional(),
  billDate: z.string().optional(),
  vehicleNo: z.string().optional(),
  remarks: z.string().optional(),

  items: z
    .array(
      z.object({
        poDetailsId: z.string().optional(),
        receivingQty: z.string().optional(),
        rate: z.string().optional(),
        amount: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});
const inputSchema = baseSchema;

type RawFormValues = z.infer<typeof inputSchema>;

function toSubmitPayload(
  data: RawFormValues,
  docs: Array<{ documentName: string; documentUrl: string | File | null }>
) {
  const payload: any = {
    purchaseOrderId: data.purchaseOrderId
      ? parseInt(data.purchaseOrderId)
      : undefined,
    vendorId: data.vendorId ? parseInt(data.vendorId) : undefined,
    siteId: data.siteId ? parseInt(data.siteId) : undefined,
    inwardChallanDate: data.inwardChallanDate || null,
    challanNo: data.challanNo?.trim() || null,
    challanDate: data.challanDate || null,
    lrNo: data.lrNo?.trim() || null,
    lRDate: data.lRDate || null,
    billNo: data.billNo?.trim() || null,
    billDate: data.billDate || null,
    vehicleNo: data.vehicleNo?.trim() || null,
    remarks: data.remarks?.trim() || null,
    inwardDeliveryChallanDetails: (data.items || [])
      .filter((it) => it.poDetailsId && it.poDetailsId !== "")
      .map((it) => ({
        poDetailsId: parseInt(it.poDetailsId as string),
        receivingQty:
          it.receivingQty && it.receivingQty !== ""
            ? Number(it.receivingQty)
            : 0,
      })),
    inwardDeliveryChallanDocuments: docs.map((doc, index) => ({
      documentName: doc.documentName || "",
      documentUrl:
        typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
      index,
    })),
  };
  return payload;
}

export default function InwardDeliveryChallanForm({
  initial,
  onSuccess,
  redirectOnSuccess = "/inward-delivery-challans",
}: InwardDeliveryChallanFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<
    Array<{
      id?: number;
      documentName: string;
      documentUrl: string | File | null;
      _tempId?: number;
    }>
  >([]);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      purchaseOrderId: initial?.purchaseOrderId
        ? String(initial.purchaseOrderId)
        : "",
      vendorId: initial?.vendorId ? String(initial.vendorId) : "",
      siteId: initial?.siteId ? String(initial.siteId) : "",
      inwardChallanDate: initial?.inwardChallanDate
        ? initial.inwardChallanDate.split("T")[0]
        : "",
      challanNo: initial?.challanNo || "",
      challanDate: initial?.challanDate
        ? initial.challanDate.split("T")[0]
        : "",
      lrNo: initial?.lrNo || "",
      lRDate: initial?.lRDate ? initial.lRDate.split("T")[0] : "",
      billNo: initial?.billNo || "",
      billDate: initial?.billDate ? initial.billDate.split("T")[0] : "",
      vehicleNo: initial?.vehicleNo || "",
      remarks: initial?.remarks || "",

      items:
        (initial?.items || [])?.map((it) => ({
          poDetailsId: it.poDetailsId ? String(it.poDetailsId) : "",
          receivingQty: it.receivingQty != null ? String(it.receivingQty) : "",
          rate: it.rate != null ? String(it.rate) : "",
          amount: it.amount != null ? String(it.amount) : "",
        })) || [],
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = !initial?.id;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if ((initial as any)?.inwardDeliveryChallanDocuments) {
      const docs = (
        (initial as any).inwardDeliveryChallanDocuments as Array<any>
      ).map((d) => ({
        id: d.id,
        documentName: d.documentName || "",
        documentUrl: d.documentUrl || "",
      }));
      setDocuments(docs);
    }
  }, [initial]);

  const { data: sitesData } = useSWR<any>("/api/sites?perPage=100", apiGet);
  const { data: vendorsData } = useSWR<any>("/api/vendors?perPage=100", apiGet);
  const siteIdVal = form.watch("siteId");
  const purchaseOrderIdVal = form.watch("purchaseOrderId");
  const { data: posData } = useSWR<any>(
    siteIdVal
      ? `/api/purchase-orders?perPage=1000&site=${siteIdVal}&excludeLinked=true`
      : null,
    apiGet
  );
  const { data: poDetail } = useSWR<any>(
    purchaseOrderIdVal && String(purchaseOrderIdVal).trim() !== ""
      ? `/api/purchase-orders/${purchaseOrderIdVal}`
      : null,
    apiGet
  );

  useEffect(() => {
    // When site changes, clear dependent fields
    form.setValue("purchaseOrderId", "", { shouldValidate: true });
    form.setValue("vendorId", "", { shouldValidate: true });
  }, [siteIdVal]);

  // When PO changes, auto-select vendor from the POs list (no extra call)
  useEffect(() => {
    if (!purchaseOrderIdVal) {
      form.setValue("vendorId", "", { shouldValidate: true });
      return;
    }
    const selected = posData?.data?.find?.(
      (po: any) => String(po.id) === String(purchaseOrderIdVal)
    );
    const vId = selected?.vendorId ?? selected?.vendor?.id;
    if (vId) {
      form.setValue("vendorId", String(vId), { shouldValidate: true });
    }
  }, [purchaseOrderIdVal, posData?.data]);

  // Also replace challan detail items from PO details
  useEffect(() => {
    const poItems = poDetail?.purchaseOrderDetails || [];
    if (Array.isArray(poItems)) {
      const mapped = poItems.map((d: any) => ({
        poDetailsId: String(d.id ?? ""),
        receivingQty: "",
        rate: "",
        amount: "",
      }));
      form.setValue("items", mapped, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [poDetail?.purchaseOrderDetails]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const hasDocFiles = documents.some((d) => d.documentUrl instanceof File);
      const shouldUseFormData = hasDocFiles;

      if (shouldUseFormData) {
        const formDataPayload = new FormData();
        const payload = toSubmitPayload(data, documents);
        Object.entries(payload).forEach(([key, val]) => {
          if (
            key === "inwardDeliveryChallanDetails" ||
            key === "inwardDeliveryChallanDocuments"
          )
            return;
          if (val === undefined || val === null || val === "") return;
          if (val instanceof Date)
            formDataPayload.append(key, val.toISOString());
          else formDataPayload.append(key, String(val));
        });

        formDataPayload.append(
          "inwardDeliveryChallanDetails",
          JSON.stringify(payload.inwardDeliveryChallanDetails || [])
        );

        const docMetadata = documents.map((doc, index) => ({
          id: typeof doc.id === "number" && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || "",
          documentUrl:
            typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
          index,
        }));
        formDataPayload.append(
          "inwardDeliveryChallanDocuments",
          JSON.stringify(docMetadata)
        );
        documents.forEach((doc, index) => {
          if (doc.documentUrl instanceof File) {
            formDataPayload.append(
              `inwardDeliveryChallanDocuments[${index}][documentFile]`,
              doc.documentUrl,
              doc.documentUrl.name
            );
          }
        });

        const response = await fetch("/api/inward-delivery-challans", {
          method: "POST",
          body: formDataPayload,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `HTTP ${response.status}: Failed to save challan`
          );
        }
        await response.json();
      } else {
        const payload = toSubmitPayload(data, documents);
        await apiPost("/api/inward-delivery-challans", payload);
      }

      toast.success("Inward Delivery Challan created");
      onSuccess?.();
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate
              ? "Create Inward Delivery Challan"
              : "Inward Delivery Challan"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add a new inward delivery challan." : "View challan."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection
              legend={<span className="text-base font-semibold">General</span>}
            >
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="inwardChallanDate"
                  label="Inward Challan Date *"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="challanNo"
                  label="Challan No *"
                  placeholder="Enter challan no"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="challanDate"
                  label="Challan Date *"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
              </FormRow>
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="lrNo"
                  label="LR No"
                  placeholder="Enter LR no"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="lRDate"
                  label="LR Date"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="vehicleNo"
                  label="Vehicle No"
                  placeholder="Enter vehicle no"
                  span={1}
                  spanFrom="md"
                />
              </FormRow>
              <FormRow cols={3} from="md">
                <AppSelect
                  control={control}
                  name="siteId"
                  label="Site *"
                  placeholder="Select site"
                  triggerClassName="h-9 w-full"
                >
                  {sitesData?.data?.map((s: any) => (
                    <AppSelect.Item key={s.id} value={String(s.id)}>
                      {s.site}
                    </AppSelect.Item>
                  ))}
                </AppSelect>
                <AppSelect
                  control={control}
                  name="vendorId"
                  label="Vendor *"
                  placeholder="Auto-selected from PO"
                  triggerClassName="h-9 w-full"
                  disabled
                >
                  {vendorsData?.data?.map((v: any) => (
                    <AppSelect.Item key={v.id} value={String(v.id)}>
                      {v.vendorName}
                    </AppSelect.Item>
                  ))}
                </AppSelect>
                <AppSelect
                  control={control}
                  name="purchaseOrderId"
                  label="Purchase Order *"
                  placeholder="Select PO"
                  triggerClassName="h-9 w-full"
                >
                  {posData?.data?.map((po: any) => (
                    <AppSelect.Item key={po.id} value={String(po.id)}>
                      {po.purchaseOrderNo}
                    </AppSelect.Item>
                  ))}
                </AppSelect>
              </FormRow>

              <FormRow cols={1} from="md">
                <TextInput
                  control={control}
                  name="remarks"
                  label="Remarks"
                  placeholder="Enter remarks"
                  span={1}
                  spanFrom="md"
                />
              </FormRow>
            </FormSection>

            <FormSection
              legend={
                <span className="text-base font-semibold">
                  Inward Delivery Challan Details
                </span>
              }
            >
              <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-sm">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground">
                  <div className="col-span-1">Sr No</div>
                  <div className="col-span-4">Item</div>
                  <div className="col-span-2">PO Qty</div>
                  <div className="col-span-3">Receiving Qty</div>
                  <div className="col-span-2">Closing Stock</div>
                </div>
                {fields.map((field, index) => {
                  const d = (poDetail?.purchaseOrderDetails || [])[index];
                  const sr = d?.serialNo ?? index + 1;
                  const itemName = d?.item?.item ?? d?.itemName ?? "-";
                  const qty = d?.qty ?? d?.approved2Qty ?? d?.orderedQty ?? "-";
                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-12 gap-3 items-center py-2 border-b"
                    >
                      <div className="col-span-1">{sr}</div>
                      <div className="col-span-4 truncate">{itemName}</div>
                      <div className="col-span-2">{String(qty)}</div>
                      <div className="col-span-3">
                        <TextInput
                          control={control}
                          name={`items.${index}.receivingQty`}
                          label=""
                          type="number"
                          placeholder="0"
                          span={12}
                        />
                      </div>
                      <div className="col-span-2">-</div>
                    </div>
                  );
                })}
                {fields.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3">
                    Select a Purchase Order to load details.
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              legend={
                <span className="text-base font-semibold">Documents</span>
              }
            >
              <div className="space-y-4">
                {documents.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No documents added.
                  </div>
                )}
                {documents.map((doc, index) => {
                  const inputId = `idc-doc-${index}`;
                  const isFileObject =
                    doc.documentUrl &&
                    typeof doc.documentUrl !== "string" &&
                    (doc.documentUrl as File).name;
                  return (
                    <div
                      key={(doc as any)._tempId ?? doc.id ?? index}
                      className="rounded-2xl border p-4 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-2 min-w-0">
                            <label className="text-sm font-semibold">
                              Document Name
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              className="mt-2 w-full rounded-lg border border-muted bg-background px-3 py-2 text-sm"
                              value={doc.documentName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDocuments((prev) =>
                                  prev.map((d, i) =>
                                    i === index ? { ...d, documentName: v } : d
                                  )
                                );
                              }}
                              placeholder="e.g. Invoice, LR, Ewaybill"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-destructive inline-flex items-center text-sm"
                          onClick={() =>
                            setDocuments((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">
                          File<span className="text-red-500">*</span>
                        </label>
                        <label
                          htmlFor={inputId}
                          className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {isFileObject
                                  ? (doc.documentUrl as File).name
                                  : "Click to select a file"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, PDF up to 20 MB.
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
                            Browse
                          </span>
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setDocuments((prev) =>
                              prev.map((d, i) =>
                                i === index ? { ...d, documentUrl: file } : d
                              )
                            );
                          }}
                        />
                        {typeof doc.documentUrl === "string" &&
                          doc.documentUrl && (
                            <div className="pt-2">
                              {(() => {
                                const url = doc.documentUrl as string;
                                const href = url.startsWith("/uploads/")
                                  ? `/api${url}`
                                  : url;
                                return (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary text-sm underline"
                                  >
                                    View existing
                                  </a>
                                );
                              })()}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center text-sm border rounded-md px-3 py-2"
                    onClick={() =>
                      setDocuments((prev) => [
                        ...prev,
                        {
                          documentName: "",
                          documentUrl: null,
                          _tempId: -Date.now(),
                        },
                      ])
                    }
                  >
                    <Upload className="h-4 w-4 mr-2" /> Add Document
                  </button>
                </div>
              </div>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push(redirectOnSuccess)}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName="Plus"
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              Create Challan
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
