"use client";

import { useState, useMemo, Fragment, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Minus } from "lucide-react";

import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { AppCombobox } from "@/components/common/app-combobox";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { amountInWords } from "@/lib/payroll";

function formatBillingAddressLabel(address: any) {
  if (!address) return "";
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.city?.city,
    address.state?.state,
    address.pincode || address.pinCode,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(", ") || address.companyName || `Address ${address.id}`;
}

const optionalDecimal = () => z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (val === "" || val === undefined || val === null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}, z.number().optional().nullable());

const itemSchema = z.object({
  id: z.number().optional(),
  isBoqItem: z.boolean().default(false),
  executedQty: optionalDecimal(),
  executedAmount: optionalDecimal(),
  boqItemId: z.coerce.number().optional().nullable(),
  item: z.string().min(1, "Item is required"),
  sacCode: z.string().optional().nullable(),
  unitId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "Unit is required")),
  qty: optionalDecimal().transform((v) => v === null ? v : Number(v)).refine((v) => typeof v === 'number' && v > 0, { message: 'Quantity must be greater than 0' }),
  approved1Qty: optionalDecimal(),
  approved2Qty: optionalDecimal(),
  rate: optionalDecimal().transform((v) => v === null ? v : Number(v)).refine((v) => typeof v === 'number' && v > 0, { message: 'Rate must be greater than 0' }),
  cgst: optionalDecimal(),
  sgst: optionalDecimal(),
  igst: optionalDecimal(),
  // Derived
  cgstAmt: z.number().optional(),
  sgstAmt: z.number().optional(),
  igstAmt: z.number().optional(),
  amount: z.number().optional(),
});

const formSchema = z.object({
  siteId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "Site is required")),
  boqId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "BOQ is required")),
  subContractorId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "SubContractor is required")),
  vendorId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "Vendor is required")),
  billingAddressId: z.preprocess((val) => (val === "" || val === undefined || val === null) ? 0 : Number(val), z.number().min(1, "Billing Address is required")),
  workOrderDate: z.string().min(1, "Date is required"),
  typeOfWorkOrder: z.string().min(1, "Type is required"),
  quotationNo: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable(),
  paymentTermsInDays: z.coerce.number().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  deliverySchedule: z.string().optional().nullable(),
  paymentTermIds: z.array(z.coerce.number()).min(1, "At least one payment term is required"),
  status: z.string().optional(),
  workOrderItems: z.array(itemSchema).min(1, "At least one item is required").superRefine((items, ctx) => {
    items.forEach((it, i) => {
      if (it.isBoqItem && (!it.boqItemId || it.boqItemId === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activity is required for BOQ items', path: [i, 'boqItemId'] });
      }
    });
  }),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  mode: "create" | "edit" | "approval1" | "approval2" | "view";
  initial?: any;
}

export function SubContractorWorkOrderForm({ mode, initial }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isView = mode === "view";
  const isApproval1 = mode === "approval1";
  const isApproval2 = mode === "approval2";
  const isApprovalMode = isApproval1 || isApproval2;
  const isReadOnly = isView;

  const defaultValues = useMemo(() => {
    if ((mode === "edit" || isApprovalMode || isView) && initial) {
      return {
        ...initial,
        workOrderDate: initial.workOrderDate ? format(new Date(initial.workOrderDate), "yyyy-MM-dd") : "",
        quotationDate: initial.quotationDate ? format(new Date(initial.quotationDate), "yyyy-MM-dd") : "",
        deliveryDate: initial.deliveryDate ? format(new Date(initial.deliveryDate), "yyyy-MM-dd") : "",
        paymentTermIds: initial.subContractorWorkOrderPaymentTerms?.map((p: any) => p.paymentTermId) || [],
        workOrderItems: initial.subContractorWorkOrderDetails?.map((d: any) => ({
          ...d,
          approved1Qty: d.approved1Qty ?? d.qty,
          approved2Qty: d.approved2Qty ?? d.approved1Qty ?? d.qty,
        })) || [],
        status: initial.status ?? undefined,
      };
    }
    return {
      workOrderDate: format(new Date(), "yyyy-MM-dd"),
      typeOfWorkOrder: "Lumpsum",
  workOrderItems: [{ isBoqItem: false, unitId: 0, item: "", qty: 0, rate: 0, executedQty: 0, executedAmount: null }],
      paymentTermIds: [],
      boqId: undefined,
      siteId: undefined,
      vendorId: undefined,
      billingAddressId: undefined,
      subContractorId: undefined,
      status: "DRAFT",
    };
  }, [mode, initial, isApprovalMode, isView]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "workOrderItems",
  });

  // Watchers for calculations
  const watchedItems = useWatch({ name: "workOrderItems", control: form.control }) || form.getValues("workOrderItems") || [];

  const decimalRegex2 = /^\d*(?:\.\d{0,2})?$/;
  const handleDecimalChange2 = (path: any) => (value: string) => {
    if (value === "" || decimalRegex2.test(value)) {
      form.setValue(path, value as any, { shouldDirty: true });
    }
  };

  const totals = useMemo(() => {
    let totalAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const calculatedItems = watchedItems.map((item) => {
      const _qty = typeof item.qty === 'string' && item.qty === '' ? 0 : Number(item.qty || 0);
      const _rate = typeof item.rate === 'string' && item.rate === '' ? 0 : Number(item.rate || 0);
      const _cgst = typeof item.cgst === 'string' && item.cgst === '' ? 0 : Number(item.cgst || 0);
      const _sgst = typeof item.sgst === 'string' && item.sgst === '' ? 0 : Number(item.sgst || 0);
      const _igst = typeof item.igst === 'string' && item.igst === '' ? 0 : Number(item.igst || 0);

      // Use approved quantity if in approval mode, otherwise use qty
      const effectiveQty = isApproval2 ? Number(item.approved2Qty ?? 0) : isApproval1 ? Number(item.approved1Qty ?? 0) : _qty;
      const base = effectiveQty * _rate;
      const c = (base * _cgst) / 100;
      const s = (base * _sgst) / 100;
      const i = (base * _igst) / 100;
      const amt = base + c + s + i;

      totalAmount += (amt || 0);
      totalCgst += (c || 0);
      totalSgst += (s || 0);
      totalIgst += (i || 0);

      return { ...item, cgstAmt: c, sgstAmt: s, igstAmt: i, amount: amt };
    });

    return { totalAmount, totalCgst, totalSgst, totalIgst, calculatedItems };
  }, [watchedItems, isApproval1, isApproval2]);

  const { data: sitesData } = useSWR<{ data: any[] }>("/api/sites?perPage=1000", apiGet);
  const { data: subContractorsData } = useSWR<{ data: any[] }>("/api/sub-contractors?perPage=1000", apiGet);
  const { data: vendorsData } = useSWR<{ data: any[] }>("/api/vendors?perPage=1000", apiGet);
  const { data: billingData } = useSWR<{ data: any[] }>("/api/billing-addresses?perPage=1000", apiGet);
  const { data: paymentTermsData } = useSWR<{ data: any[] }>("/api/payment-terms?perPage=1000", apiGet);
  const { data: unitsData } = useSWR<{ data: any[] }>("/api/units?perPage=1000", apiGet);

  const siteIdValue = useWatch({ name: "siteId", control: form.control }) || form.getValues("siteId");
  // Only fetch BOQs for a selected site. Do not show BOQ options before site selection.
  const { data: boqsData } = useSWR<{ data: any[] }>(
    siteIdValue ? `/api/boqs?perPage=1000&siteId=${siteIdValue}` : null,
    apiGet
  );

  const boqIdValue = useWatch({ name: "boqId", control: form.control }) || form.getValues("boqId");
  // Note: GET /api/boqs/:id returns the BOQ object directly (not wrapped in { data: ... })
  const { data: boqDetail } = useSWR<any>(boqIdValue ? `/api/boqs/${boqIdValue}` : null, apiGet);
  const boqItems = boqDetail?.items || [];

  // Recompute executedAmount when qty/rate/taxes/amount change so executedAmount stays in sync
  useEffect(() => {
    // Loop through watched items and update executedAmount where executedQty present
    const currentItems = form.getValues("workOrderItems") || [];
    currentItems.forEach((it: any, idx: number) => {
      const execQty = Number(it?.executedQty || 0);
      if (!execQty || execQty <= 0) return;
      const itemQty = Number(it?.qty || 0);
      const totalAmount = Number((totals.calculatedItems[idx] && totals.calculatedItems[idx].amount) || 0);
      let unitAmount = 0;
      if (itemQty > 0 && totalAmount > 0) {
        unitAmount = totalAmount / itemQty;
      } else {
        unitAmount = Number(it?.rate || 0);
      }
      const newExecAmt = Number((execQty * unitAmount) || 0);
      const existingExecAmt = Number(it?.executedAmount || 0);
      // Only update if difference is significant (> 0.01)
      if (Math.abs(existingExecAmt - newExecAmt) > 0.01) {
        form.setValue(`workOrderItems.${idx}.executedAmount`, newExecAmt as any, { shouldDirty: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.calculatedItems, watchedItems]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...data,
        totalAmount: totals.totalAmount,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        amountInWords: amountInWords(totals.totalAmount),
        workOrderItems: totals.calculatedItems,
      };

      if (isApprovalMode) {
        payload.statusAction = isApproval1 ? "approve1" : "approve2";
      }

      if (mode === "create") {
        await apiPost("/api/sub-contractor-work-orders", payload);
        toast.success("Work order created");
      } else {
        await apiPatch(`/api/sub-contractor-work-orders/${initial.id}`, payload);
        toast.success("Work order updated");
      }
      router.push("/sub-contractor-work-orders");
    } catch (e: any) {
      toast.error(e.message || "Failed to save work order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>{mode === "create" ? "New" : isApprovalMode ? "Approve" : isView ? "View" : "Edit"} SubContractor Work Order</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            <FormSection title="General Information">
              <FormRow cols={3}>
                <div><TextInput label="WO Date" name="workOrderDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div>
                  <FormField
                    control={form.control}
                    name="siteId"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Site</label>
                        <FormControl>
                          <AppCombobox
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                            options={sitesData?.data?.map((s: any) => ({ label: s.site, value: s.id.toString() })) || []}
                            placeholder="Select Site"
                            disabled={isReadOnly || isApprovalMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="boqId"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">BOQ</label>
                        <FormControl>
                          <AppCombobox
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                            options={boqsData?.data?.map((b: any) => ({ label: b.boqNo, value: b.id.toString() })) || []}
                            placeholder="Select BOQ"
                            disabled={isReadOnly || isApprovalMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="subContractorId"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">SubContractor</label>
                        <FormControl>
                          <AppCombobox
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                            options={subContractorsData?.data?.map((sc: any) => ({ label: sc.name, value: sc.id.toString() })) || []}
                            placeholder="Select SubContractor"
                            disabled={isReadOnly || isApprovalMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Vendor</label>
                        <FormControl>
                          <AppCombobox
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                            options={vendorsData?.data?.map((v: any) => ({ label: v.vendorName, value: v.id.toString() })) || []}
                            placeholder="Select Vendor"
                            disabled={isReadOnly || isApprovalMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="billingAddressId"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Billing Address</label>
                        <FormControl>
                          <AppCombobox
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                            options={billingData?.data?.map((ba: any) => ({ label: formatBillingAddressLabel(ba), value: ba.id.toString() })) || []}
                            placeholder="Select Billing Address"
                            disabled={isReadOnly || isApprovalMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="typeOfWorkOrder"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Type of WO</label>
                        <FormControl>
                          <AppSelect value={field.value || ""} onValueChange={(val) => field.onChange(val)} disabled={isReadOnly || isApprovalMode}>
                            <AppSelect.Item value="Sub Contract">Sub Contract</AppSelect.Item>
                            <AppSelect.Item value="PRW Work">PRW Work</AppSelect.Item>
                          </AppSelect>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Status</label>
                        <FormControl>
                          <AppSelect value={field.value || "DRAFT"} onValueChange={(v) => field.onChange(v)} disabled={isReadOnly || isApprovalMode}>
                            <AppSelect.Item value="DRAFT">Draft</AppSelect.Item>
                            <AppSelect.Item value="HOLD">Hold</AppSelect.Item>
                          </AppSelect>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div><TextInput label="Quotation No" name="quotationNo" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div><TextInput label="Quotation Date" name="quotationDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
              </FormRow>
            </FormSection>

            <FormSection title="Delivery & Payments" className="mt-6">
              <FormRow cols={3}>
                <div><TextInput label="Delivery Date" name="deliveryDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div><TextInput label="Payment Terms (Days)" name="paymentTermsInDays" type="text" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div><MultiSelectInput
                  label="Payment Terms"
                  name="paymentTermIds"
                  control={form.control}
                  disabled={isReadOnly || isApprovalMode}
                  options={paymentTermsData?.data?.map((pt: any) => ({ label: pt.paymentTerm, value: pt.id })) || []}
                /></div>
                <div><TextareaInput label="Delivery Schedule" name="deliverySchedule" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div><TextareaInput label="Terms & Conditions" name="terms" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
                <div><TextareaInput label="Note" name="note" control={form.control} disabled={isReadOnly || isApprovalMode} /></div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header className="flex flex-row items-center justify-between pb-2">
            <AppCard.Title>Work Order Items</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            <div className="w-full overflow-x-auto rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="w-full border-collapse bg-transparent text-[11px] min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-700">
                    {!isReadOnly && !isApprovalMode && <th className="w-10 px-2 py-2 text-center border-r border-slate-200 dark:border-slate-700"></th>}
                    <th className="px-2 py-2 text-left">Item Details</th>
                    <th className="w-32 px-2 py-2 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const isBoqItemVal = form.watch(`workOrderItems.${index}.isBoqItem`);
                    return (
                    <Fragment key={field.id}>
                      {/* Row 1 */}
                      <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                        {!isReadOnly && !isApprovalMode && (
                          <td rowSpan={3} className={`border-r border-slate-200 dark:border-slate-700 px-1 py-1 align-top text-center ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive h-7 w-7 mt-2" title="Remove Item">
                              <Minus className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                        <td className="px-2 py-2 pt-3">
                          <div className="flex gap-4 items-start">
                            <FormField
                              control={form.control}
                              name={`workOrderItems.${index}.isBoqItem`}
                              render={({ field: isBoqField }) => (
                                <FormItem className="flex items-center gap-2 space-y-0 mt-1.5 min-w-[80px]">
                                  <FormControl>
                                    <Checkbox checked={isBoqField.value} onCheckedChange={isBoqField.onChange} disabled={isReadOnly || isApprovalMode} />
                                  </FormControl>
                                  <label className="text-[11px] font-medium leading-none cursor-pointer">BOQ Item</label>
                                </FormItem>
                              )}
                            />
                            {isBoqItemVal && (
                              <div className="w-48">
                                <FormField
                                  control={form.control}
                                  name={`workOrderItems.${index}.boqItemId`}
                                  render={({ field: boqField }) => (
                                    <FormItem>
                                      <FormControl>
                                        <AppSelect
                                          value={boqField.value ? boqField.value.toString() : ""}
                                          onValueChange={(val) => {
                                            const parsed = parseInt(val);
                                            boqField.onChange(parsed);
                                            const selectedItem = boqItems.find((it: any) => it.id === parsed);
                                            if (selectedItem) {
                                              form.setValue(`workOrderItems.${index}.item`, selectedItem.item || "");
                                              form.setValue(`workOrderItems.${index}.unitId`, selectedItem.unitId);
                                              form.setValue(`workOrderItems.${index}.rate`, selectedItem.rate?.toString() as any);
                                              form.setValue(`workOrderItems.${index}.qty`, selectedItem.computedRemainingQty?.toString() as any);
                                            }
                                          }}
                                          placeholder="Select Activity"
                                          disabled={isReadOnly || isApprovalMode}
                                        >
                                          {boqItems.map((b: any) => (
                                            <AppSelect.Item key={b.id} value={b.id.toString()}>
                                              {b.activityId}
                                            </AppSelect.Item>
                                          ))}
                                        </AppSelect>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <TextareaInput
                                name={`workOrderItems.${index}.item`}
                                control={form.control}
                                label="Item Description"
                                disabled={isReadOnly || isApprovalMode}
                                className="h-14 text-[11px]"
                                itemClassName="m-0"
                              />
                            </div>
                            <div className="w-32">
                              <TextInput name={`workOrderItems.${index}.sacCode`} placeholder="SAC Code" control={form.control} disabled={isReadOnly || isApprovalMode} className="h-8 text-[11px]" />
                            </div>
                          </div>
                        </td>
                        <td rowSpan={3} className={`border-l border-slate-200 dark:border-slate-700 px-2 py-2 align-middle text-right font-bold text-sm ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                          {totals.calculatedItems[index]?.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                        </td>
                      </tr>
                      {/* Row 2 */}
                      <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                        <td className="px-2 py-2">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.qty`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">Qty</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={isReadOnly || isApprovalMode} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.qty`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-medium mb-1 block">Unit</label>
                              <AppSelect name={`workOrderItems.${index}.unitId`} control={form.control} disabled={isReadOnly || isApprovalMode}>
                                {unitsData?.data?.map((u: any) => <AppSelect.Item key={u.id} value={u.id.toString()}>{u.unitName}</AppSelect.Item>)}
                              </AppSelect>
                            </div>
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.rate`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">Rate</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={isReadOnly || isApprovalMode} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.rate`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.cgst`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">CGST %</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={isReadOnly || isApprovalMode} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.cgst`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                  <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-[14px]">
                                    {totals.calculatedItems[index]?.cgstAmt > 0 ? `₹${totals.calculatedItems[index].cgstAmt.toFixed(2)}` : ""}
                                  </div>
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.sgst`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">SGST %</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={isReadOnly || isApprovalMode} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.sgst`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                  <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-[14px]">
                                    {totals.calculatedItems[index]?.sgstAmt > 0 ? `₹${totals.calculatedItems[index].sgstAmt.toFixed(2)}` : ""}
                                  </div>
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.igst`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">IGST %</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={isReadOnly || isApprovalMode} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.igst`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                  <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-[14px]">
                                    {totals.calculatedItems[index]?.igstAmt > 0 ? `₹${totals.calculatedItems[index].igstAmt.toFixed(2)}` : ""}
                                  </div>
                                </FormItem>
                              )} />
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Row 3 */}
                      <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"} border-b-2 border-slate-300 dark:border-slate-700`}>
                        <td className="px-2 py-2 pb-3">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.executedQty`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">Executed Qty</label>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      className="h-7 text-[11px] text-right"
                                      disabled={isReadOnly || isApprovalMode}
                                      value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                          field.onChange(v);
                                          form.setValue(`workOrderItems.${index}.executedQty`, v as any, { shouldDirty: true, shouldValidate: true });

                                          const executedQtyNum = Number(v || 0);
                                          // Prefer unit amount derived from the full item amount (which includes taxes) divided by qty
                                          const itemQty = Number(form.watch(`workOrderItems.${index}.qty`) || 0);
                                          const totalItemAmount = Number(totals.calculatedItems[index]?.amount || 0);
                                          let unitAmount = 0;
                                          if (itemQty > 0 && totalItemAmount > 0) {
                                            unitAmount = totalItemAmount / itemQty;
                                          } else {
                                            // Fallback to rate (pre-tax unit price) if amount or qty unavailable
                                            unitAmount = Number(form.watch(`workOrderItems.${index}.rate`) || 0);
                                          }
                                          const rAmount = executedQtyNum * unitAmount;
                                          form.setValue(`workOrderItems.${index}.executedAmount`, rAmount > 0 ? rAmount as any : null, { shouldDirty: true });
                                        }
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-1">
                              <FormField control={form.control} name={`workOrderItems.${index}.executedAmount`} render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <label className="text-[10px] font-medium leading-none">Executed Amount</label>
                                  <FormControl>
                                    <Input type="text" className="h-7 text-[11px] text-right" disabled={true} value={typeof field.value === 'string' ? field.value : field.value?.toString() || ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) { field.onChange(v); form.setValue(`workOrderItems.${index}.executedAmount`, v as any, { shouldDirty: true, shouldValidate: true }); } }} />
                                  </FormControl>
                                </FormItem>
                              )} />
                            </div>
                            <div className="flex-[4]"></div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isReadOnly && !isApprovalMode && (
              <div className="mt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ isBoqItem: false, unitId: 0, item: "", qty: 0, rate: 0, executedQty: 0, executedAmount: null })}>
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            )}

            <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm">
                <span className="text-muted-foreground">Total CGST:</span>
                <span className="text-right">{totals.totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span className="text-muted-foreground">Total SGST:</span>
                <span className="text-right">{totals.totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span className="text-muted-foreground">Total IGST:</span>
                <span className="text-right">{totals.totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span className="text-lg font-bold border-t pt-1">Grand Total:</span>
                <span className="text-lg font-bold border-t pt-1 text-right">
                  {totals.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>

        <div className="flex justify-end gap-3">
          <AppButton variant="outline" type="button" onClick={() => router.back()} className="text-black dark:text-white">
            {isReadOnly ? "Back" : "Cancel"}
          </AppButton>
          {!isReadOnly && (
            <AppButton type="submit" isLoading={isSubmitting}>
              {mode === "create" ? "Create Work Order" : isApprovalMode ? "Approve" : "Update Work Order"}
            </AppButton>
          )}
        </div>
      </form>
    </Form>
  );
}
