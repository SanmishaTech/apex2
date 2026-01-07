"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
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
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { SitesResponse } from "@/types/sites";
import { Textarea } from "@/components/ui/textarea";

export interface BoqFormInitialData {
  id?: number;
  boqNo?: string | null;
  siteId?: number | null;
  workName?: string | null;
  workOrderNo?: string | null;
  workOrderDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalWorkValue?: string | number | null;
  gstRate?: string | number | null;
  agreementNo?: string | null;
  agreementStatus?: string | null;
  completionPeriod?: string | null;
  completionDate?: string | null;
  dateOfExpiry?: string | null;
  commencementDate?: string | null;
  timeExtensionDate?: string | null;
  defectLiabilityPeriod?: string | null;
  performanceSecurityMode?: string | null;
  performanceSecurityDocumentNo?: string | null;
  performanceSecurityPeriod?: string | null;
  items?: Array<{
    id?: number;
    activityId?: string | null;
    clientSrNo?: string | null;
    item?: string | null;
    unitId?: number | null;
    qty?: string | number | null;
    rate?: string | number | null;
    amount?: string | number | null;
    orderedQty?: string | number | null;
    orderedValue?: string | number | null;
    remainingQty?: string | number | null;
    remainingValue?: string | number | null;
    isGroup?: boolean | null;
  }> | null;
}

export interface BoqFormProps {
  mode: "create" | "edit";
  initial?: BoqFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/boqs'
}

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  workName: z.string().min(1, "Work name is required"),
  workOrderNo: z.string().min(1, "Work order number is required"),
  workOrderDate: z.string().min(1, "Work order date is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalWorkValue: z.string().optional(),
  gstRate: z.string().optional(),
  agreementNo: z.string().optional(),
  agreementStatus: z.string().optional(),
  completionPeriod: z.string().optional(),
  completionDate: z.string().optional(),
  dateOfExpiry: z.string().optional(),
  commencementDate: z.string().optional(),
  timeExtensionDate: z.string().optional(),
  defectLiabilityPeriod: z.string().optional(),
  performanceSecurityMode: z.string().optional(),
  performanceSecurityDocumentNo: z.string().optional(),
  performanceSecurityPeriod: z.string().optional(),
  items: z
    .array(
      z
        .object({
          id: z.string().optional(),
          activityId: z.string().optional(),
          clientSrNo: z.string().optional(),
          item: z.string().optional(),
          unitId: z.string().optional(),
          qty: z.string().optional(),
          rate: z.string().optional(),
          orderedQty: z.string().optional(),
          orderedValue: z.string().optional(),
          remainingQty: z.string().optional(),
          remainingValue: z.string().optional(),
          isGroup: z.boolean().optional().default(false),
        })
        .superRefine((val, ctx) => {
          const qty = Number(val.qty ?? 0);
          const ordered = Number(val.orderedQty ?? 0);
          if (isFinite(qty) && isFinite(ordered) && ordered > qty) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Ordered qty cannot be greater than Qty",
              path: ["orderedQty"],
            });
          }
        })
    )
    .optional()
    .default([]),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    siteId: data.siteId && data.siteId !== "" ? parseInt(data.siteId) : null,
    workName: data.workName?.trim() || null,
    workOrderNo: data.workOrderNo?.trim() || null,
    workOrderDate:
      data.workOrderDate && data.workOrderDate !== ""
        ? new Date(data.workOrderDate).toISOString()
        : null,
    startDate:
      data.startDate && data.startDate !== ""
        ? new Date(data.startDate).toISOString()
        : null,
    endDate:
      data.endDate && data.endDate !== ""
        ? new Date(data.endDate).toISOString()
        : null,
    totalWorkValue:
      data.totalWorkValue && data.totalWorkValue !== ""
        ? data.totalWorkValue
        : null, // keep as string for Decimal
    gstRate: data.gstRate && data.gstRate !== "" ? data.gstRate : null, // keep as string for Decimal
    agreementNo: data.agreementNo?.trim() || null,
    agreementStatus: data.agreementStatus?.trim() || null,
    completionPeriod: data.completionPeriod?.trim() || null,
    completionDate:
      data.completionDate && data.completionDate !== ""
        ? new Date(data.completionDate).toISOString()
        : null,
    dateOfExpiry:
      data.dateOfExpiry && data.dateOfExpiry !== ""
        ? new Date(data.dateOfExpiry).toISOString()
        : null,
    commencementDate:
      data.commencementDate && data.commencementDate !== ""
        ? new Date(data.commencementDate).toISOString()
        : null,
    timeExtensionDate:
      data.timeExtensionDate && data.timeExtensionDate !== ""
        ? new Date(data.timeExtensionDate).toISOString()
        : null,
    defectLiabilityPeriod: data.defectLiabilityPeriod?.trim() || null,
    performanceSecurityMode: data.performanceSecurityMode?.trim() || null,
    performanceSecurityDocumentNo:
      data.performanceSecurityDocumentNo?.trim() || null,
    performanceSecurityPeriod: data.performanceSecurityPeriod?.trim() || null,
    items: (data.items || []).map((it) => ({
      // Always include id key: number for existing, "" for new
      id: it.id === undefined || it.id === "" ? "" : parseInt(it.id),
      activityId: it.activityId?.trim() || null,
      clientSrNo: it.clientSrNo?.trim() || null,
      item: it.item?.trim() || null,
      unitId: it.unitId && it.unitId !== "" ? parseInt(it.unitId) : null,
      qty: it.qty && it.qty !== "" ? it.qty : null,
      rate: it.rate && it.rate !== "" ? it.rate : null,
      orderedQty: it.orderedQty && it.orderedQty !== "" ? it.orderedQty : null,
      orderedValue:
        it.orderedValue && it.orderedValue !== "" ? it.orderedValue : null,
      remainingQty:
        it.remainingQty && it.remainingQty !== "" ? it.remainingQty : null,
      remainingValue:
        it.remainingValue && it.remainingValue !== ""
          ? it.remainingValue
          : null,
      isGroup: Boolean(it.isGroup) || false,
    })),
  };
}

export function BoqForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/boqs",
}: BoqFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Add effect to style asterisks red after component mounts
  useEffect(() => {
    const styleAsterisks = () => {
      const labels = document.querySelectorAll("label");
      labels.forEach((label) => {
        const text = label.textContent || "";
        if (text.includes("*")) {
          const parts = text.split("*");
          if (parts.length === 2) {
            label.innerHTML = `${parts[0]}<span style="color: #ef4444; font-weight: bold;">*</span>${parts[1]}`;
          }
        }
      });
    };

    // Run after a short delay to ensure DOM is ready
    const timer = setTimeout(styleAsterisks, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch sites for dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites/options",
    apiGet
  );
  // Fetch units for dropdown
  const { data: unitsData } = useSWR<any>("/api/units?perPage=100", apiGet);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : "",
      workName: initial?.workName || "",
      workOrderNo: initial?.workOrderNo || "",
      workOrderDate: initial?.workOrderDate
        ? initial.workOrderDate.split("T")[0]
        : "",
      startDate: initial?.startDate ? initial.startDate.split("T")[0] : "",
      endDate: initial?.endDate ? initial.endDate.split("T")[0] : "",
      totalWorkValue:
        initial?.totalWorkValue != null ? String(initial.totalWorkValue) : "",
      gstRate: initial?.gstRate != null ? String(initial.gstRate) : "",
      agreementNo: initial?.agreementNo || "",
      agreementStatus: initial?.agreementStatus || "",
      completionPeriod: initial?.completionPeriod || "",
      completionDate: initial?.completionDate
        ? initial.completionDate.split("T")[0]
        : "",
      dateOfExpiry: initial?.dateOfExpiry
        ? initial.dateOfExpiry.split("T")[0]
        : "",
      commencementDate: initial?.commencementDate
        ? initial.commencementDate.split("T")[0]
        : "",
      timeExtensionDate: initial?.timeExtensionDate
        ? initial.timeExtensionDate.split("T")[0]
        : "",
      defectLiabilityPeriod: initial?.defectLiabilityPeriod || "",
      performanceSecurityMode: initial?.performanceSecurityMode || "",
      performanceSecurityDocumentNo:
        initial?.performanceSecurityDocumentNo || "",
      performanceSecurityPeriod: initial?.performanceSecurityPeriod || "",
      items:
        (initial?.items || [])?.map((it) => ({
          id: it.id != null ? String(it.id) : "",
          activityId: it.activityId || "",
          clientSrNo: it.clientSrNo || "",
          item: it.item || "",
          unitId: it.unitId ? String(it.unitId) : "",
          qty: it.qty != null ? String(it.qty) : "",
          rate: it.rate != null ? String(it.rate) : "",
          orderedQty: it.orderedQty != null ? String(it.orderedQty) : "",
          orderedValue: it.orderedValue != null ? String(it.orderedValue) : "",
          remainingQty: it.remainingQty != null ? String(it.remainingQty) : "",
          remainingValue:
            it.remainingValue != null ? String(it.remainingValue) : "",
          isGroup: Boolean(it.isGroup) || false,
        })) || [],
    },
  });

  const { control, handleSubmit, setValue } = form;
  const isCreate = mode === "create";
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Computed values for amounts
  const itemsWatch = useWatch({ control, name: "items" });
  function computeAmount(qty?: string, rate?: string) {
    const q = Number(qty);
    const r = Number(rate);
    if (!isFinite(q) || !isFinite(r)) return "";
    return (q * r).toFixed(2);
  }

  // Auto-calculate Ordered/Remaining values = qty * rate
  useEffect(() => {
    (itemsWatch || []).forEach((row, index) => {
      const r = Number(row?.rate);
      const oq = Number(row?.orderedQty);
      const cq = Number(row?.remainingQty);

      const orderedValue =
        isFinite(oq) && isFinite(r) ? (oq * r).toFixed(2) : "";
      const remainingValue =
        isFinite(cq) && isFinite(r) ? (cq * r).toFixed(2) : "";

      if ((row?.orderedValue ?? "") !== orderedValue) {
        setValue(`items.${index}.orderedValue` as any, orderedValue, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
      if ((row?.remainingValue ?? "") !== remainingValue) {
        setValue(`items.${index}.remainingValue` as any, remainingValue, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    });
  }, [itemsWatch, setValue]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost("/api/boqs", payload);
        toast.success("BOQ created");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const res = await apiPatch("/api/boqs", { id: initial.id, ...payload });
        toast.success("BOQ updated");
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as any;
      const serverErrors = e?.data?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        const msg = serverErrors
          .map((it: any) => (typeof it?.message === "string" ? it.message : ""))
          .filter(Boolean)
          .join("\n");
        toast.error(msg || e?.message || "Failed");
      } else {
        toast.error(e?.message || "Failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onInvalid(errors: Record<string, any>) {
    const messages: string[] = [];
    const collect = (err: any) => {
      if (!err) return;
      if (Array.isArray(err)) {
        err.forEach(collect);
        return;
      }
      if (typeof err === "object") {
        if (typeof err.message === "string" && err.message) messages.push(err.message);
        Object.values(err).forEach(collect);
      }
    };
    collect(errors);
    const msg = Array.from(new Set(messages)).filter(Boolean).slice(0, 3).join("\n");
    toast.error(msg || "Please fix validation errors");
  }

  return (
    <>
      <style jsx global>{`
        /* Ensure labels maintain their original color while asterisks are styled by JavaScript */
        label {
          color: inherit;
        }
      `}</style>
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>
              {isCreate ? "Create BOQ" : "Edit BOQ"}
            </AppCard.Title>
            <AppCard.Description>
              {isCreate ? "Add a new Bill of Quantity." : "Update BOQ details."}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)}>
            <AppCard.Content>
              {!isCreate && initial?.boqNo ? (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-1">B.O.Q. No.</div>
                  <div className="h-9 px-3 inline-flex items-center rounded-md border bg-muted/30 text-muted-foreground">
                    {initial.boqNo}
                  </div>
                </div>
              ) : null}
              <FormSection
                legend={
                  <span className="text-base font-semibold">General</span>
                }
              >
                <FormRow cols={1} from="md">
                  <AppSelect
                    control={control}
                    name="siteId"
                    label="Site *"
                    placeholder="Select site"
                    triggerClassName="h-9 w-full"
                  >
                    {sitesData?.data?.map((s) => (
                      <AppSelect.Item key={s.id} value={String(s.id)}>
                        {s.site}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">Work Order</span>
                }
              >
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="workOrderNo"
                    label="Work Order No *"
                    placeholder="Enter work order number"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="workName"
                    label="Work Name *"
                    placeholder="Enter work name"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="workOrderDate"
                    label="Work Order Date *"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="startDate"
                    label="Start Date"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="endDate"
                    label="End Date"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Values & Taxes
                  </span>
                }
              >
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="totalWorkValue"
                    label="Total Work Value"
                    type="number"
                    placeholder="0.00"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="gstRate"
                    label="GST Rate (%)"
                    type="number"
                    placeholder="0.00"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">Agreement</span>
                }
              >
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="agreementNo"
                    label="Agreement No"
                    placeholder="Enter agreement number"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="agreementStatus"
                    label="Agreement Status"
                    placeholder="Enter agreement status"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="completionPeriod"
                    label="Completion Period"
                    placeholder="Enter completion period"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="completionDate"
                    label="Completion Date"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="dateOfExpiry"
                    label="Date Of Expiry"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="commencementDate"
                    label="Commencement Date"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="timeExtensionDate"
                    label="Time Extension Date"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Performance Security
                  </span>
                }
              >
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="defectLiabilityPeriod"
                    label="Defect Liability Period"
                    placeholder="Enter defect liability period"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="performanceSecurityMode"
                    label="Performance Security Mode"
                    placeholder="Enter security mode"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="performanceSecurityDocumentNo"
                    label="Performance Security Document No"
                    placeholder="Enter document number"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="performanceSecurityPeriod"
                    label="Performance Security Period"
                    placeholder="Enter security period"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Bill Of Quantity Details
                  </span>
                }
              >
                <div className="flex flex-col gap-4">
                  {fields.map((field, index) => {
                    const row = itemsWatch?.[index];
                    const amount = computeAmount(row?.qty, row?.rate);
                    return (
                      <div
                        key={field.id}
                        className="border rounded-md p-4 bg-card"
                      >
                        <div className="grid grid-cols-12 gap-6">
                          <TextInput
                            control={control}
                            name={`items.${index}.activityId`}
                            label="Activity ID"
                            placeholder="Enter activity ID"
                            span={4}
                            spanFrom="md"
                          />
                          <TextInput
                            control={control}
                            name={`items.${index}.clientSrNo`}
                            label="Client Sr No."
                            placeholder="Enter client serial number"
                            span={4}
                            spanFrom="md"
                          />
                          <AppSelect
                            control={control}
                            name={`items.${index}.unitId`}
                            label="Unit"
                            placeholder="Select unit"
                            className="col-span-12 md:col-span-4 lg:col-span-4"
                            triggerClassName="h-9 w-full min-w-[200px]"
                          >
                            {unitsData?.data?.map((u: any) => (
                              <AppSelect.Item key={u.id} value={String(u.id)}>
                                {u.unitName}
                              </AppSelect.Item>
                            ))}
                          </AppSelect>
                        </div>
                        <div className="grid grid-cols-12 gap-6 mt-3">
                          <TextInput
                            control={control}
                            name={`items.${index}.qty`}
                            label="Qty"
                            type="number"
                            placeholder="0"
                            span={4}
                            spanFrom="md"
                            onInput={(e) => {
                              const v = (e as React.FormEvent<HTMLInputElement>)
                                .currentTarget.value;
                              const q = Number(v);
                              const oq = Number(
                                itemsWatch?.[index]?.orderedQty
                              );
                              const remainingQty =
                                isFinite(q) && isFinite(oq)
                                  ? (q - oq).toFixed(2)
                                  : "";
                              setValue(
                                `items.${index}.remainingQty` as any,
                                remainingQty,
                                {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                }
                              );
                            }}
                          />
                          <TextInput
                            control={control}
                            name={`items.${index}.rate`}
                            label="Rate"
                            type="number"
                            placeholder="0.00"
                            span={4}
                            spanFrom="md"
                            onInput={(e) => {
                              const v = (e as React.FormEvent<HTMLInputElement>)
                                .currentTarget.value;
                              const row = itemsWatch?.[index];
                              const r = Number(v);
                              const oq = Number(row?.orderedQty);
                              const cq = Number(row?.remainingQty);
                              const orderedValue =
                                isFinite(oq) && isFinite(r)
                                  ? (oq * r).toFixed(2)
                                  : "";
                              const remainingValue =
                                isFinite(cq) && isFinite(r)
                                  ? (cq * r).toFixed(2)
                                  : "";
                              setValue(
                                `items.${index}.orderedValue` as any,
                                orderedValue,
                                { shouldValidate: true, shouldDirty: true }
                              );
                              setValue(
                                `items.${index}.remainingValue` as any,
                                remainingValue,
                                { shouldValidate: true, shouldDirty: true }
                              );
                            }}
                          />
                          <div className="col-span-12 md:col-span-4 lg:col-span-4">
                            <FormLabel>Amount</FormLabel>
                            <div className="h-9 px-3 flex items-center rounded-md border bg-muted/30 text-right tabular-nums">
                              {amount || "0.00"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <FormField
                            control={control as any}
                            name={`items.${index}.item`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe the item..."
                                    className="min-h-[80px]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-12 gap-6 mt-3">
                          <div className="col-span-12 md:col-span-6 lg:col-span-6">
                            <FormLabel className="text-xs text-muted-foreground">
                              Ordered Qty
                            </FormLabel>
                            <TextInput
                              control={control}
                              name={`items.${index}.orderedQty`}
                              label=""
                              type="number"
                              placeholder="0"
                              onInput={(e) => {
                                const v = (
                                  e as React.FormEvent<HTMLInputElement>
                                ).currentTarget.value;
                                const r = Number(itemsWatch?.[index]?.rate);
                                const oq = Number(v);
                                const orderedValue =
                                  isFinite(oq) && isFinite(r)
                                    ? (oq * r).toFixed(2)
                                    : "";
                                setValue(
                                  `items.${index}.orderedValue` as any,
                                  orderedValue,
                                  { shouldValidate: true, shouldDirty: true }
                                );
                                const q = Number(itemsWatch?.[index]?.qty);
                                const remainingQty =
                                  isFinite(q) && isFinite(oq)
                                    ? (q - oq).toFixed(2)
                                    : "";
                                setValue(
                                  `items.${index}.remainingQty` as any,
                                  remainingQty,
                                  { shouldValidate: true, shouldDirty: true }
                                );
                              }}
                            />
                          </div>
                          <div className="col-span-12 md:col-span-6 lg:col-span-6">
                            <FormLabel className="text-xs text-muted-foreground">
                              Value
                            </FormLabel>
                            <TextInput
                              control={control}
                              name={`items.${index}.orderedValue`}
                              label=""
                              type="number"
                              placeholder="0.00"
                              disabled
                            />
                          </div>
                          <div className="col-span-12 md:col-span-6 lg:col-span-6">
                            <FormLabel className="text-xs text-muted-foreground">
                              Remaining Qty
                            </FormLabel>
                            <TextInput
                              control={control}
                              name={`items.${index}.remainingQty`}
                              label=""
                              type="number"
                              placeholder="0"
                              disabled
                              onInput={(e) => {
                                const v = (
                                  e as React.FormEvent<HTMLInputElement>
                                ).currentTarget.value;
                                const r = Number(itemsWatch?.[index]?.rate);
                                const cq = Number(v);
                                const remainingValue =
                                  isFinite(cq) && isFinite(r)
                                    ? (cq * r).toFixed(2)
                                    : "";
                                setValue(
                                  `items.${index}.remainingValue` as any,
                                  remainingValue,
                                  { shouldValidate: true, shouldDirty: true }
                                );
                              }}
                            />
                          </div>
                          <div className="col-span-12 md:col-span-6 lg:col-span-6">
                            <FormLabel className="text-xs text-muted-foreground">
                              Value
                            </FormLabel>
                            <TextInput
                              control={control}
                              name={`items.${index}.remainingValue`}
                              label=""
                              type="number"
                              placeholder="0.00"
                              disabled
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <AppButton
                            type="button"
                            variant="destructive"
                            size="sm"
                            iconName="Trash"
                            onClick={() => remove(index)}
                          >
                            Remove
                          </AppButton>
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <AppButton
                      type="button"
                      size="sm"
                      iconName="Plus"
                      onClick={() =>
                        append({
                          id: "",
                          activityId: "",
                          clientSrNo: "",
                          item: "",
                          unitId: "",
                          qty: "",
                          rate: "",
                          orderedQty: "",
                          orderedValue: "",
                          remainingQty: "",
                          remainingValue: "",
                          isGroup: false,
                        })
                      }
                    >
                      Add Item
                    </AppButton>
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
                iconName={isCreate ? "Plus" : "Save"}
                isLoading={submitting}
                disabled={submitting || !form.formState.isValid}
              >
                {isCreate ? "Create BOQ" : "Save Changes"}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default BoqForm;
