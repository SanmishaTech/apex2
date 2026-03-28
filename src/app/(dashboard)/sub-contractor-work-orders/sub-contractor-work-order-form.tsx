"use client";

import { useState, useMemo, Fragment } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const itemSchema = z.object({
  id: z.number().optional(),
  boqItemId: z.coerce.number().optional().nullable(),
  item: z.string().optional().nullable(),
  sacCode: z.string().optional().nullable(),
  unitId: z.coerce.number().min(1, "Unit is required"),
  qty: z.coerce.number().min(0.0001, "Qty must be > 0"),
  approved1Qty: z.coerce.number().optional().nullable(),
  approved2Qty: z.coerce.number().optional().nullable(),
  rate: z.coerce.number().min(0, "Rate must be >= 0"),
  cgst: z.coerce.number().default(0),
  sgst: z.coerce.number().default(0),
  igst: z.coerce.number().default(0),
  particulars: z.string().optional().nullable(),
  // Derived
  cgstAmt: z.number().optional(),
  sgstAmt: z.number().optional(),
  igstAmt: z.number().optional(),
  amount: z.number().optional(),
});

const formSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  boqId: z.coerce.number().min(1, "BOQ is required"),
  subContractorId: z.coerce.number().min(1, "SubContractor is required"),
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  workOrderDate: z.string().min(1, "Date is required"),
  typeOfWorkOrder: z.string().min(1, "Type is required"),
  quotationNo: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable(),
  paymentTermsInDays: z.coerce.number().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  deliverySchedule: z.string().optional().nullable(),
  paymentTermIds: z.array(z.coerce.number()).default([]),
  workOrderItems: z.array(itemSchema).min(1, "At least one item is required"),
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
      };
    }
    return {
      workOrderDate: format(new Date(), "yyyy-MM-dd"),
      typeOfWorkOrder: "Lumpsum",
      workOrderItems: [{ unitId: 0, qty: 0, rate: 0, cgst: 0, sgst: 0, igst: 0 }],
      paymentTermIds: [],
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
  const watchedItems = form.watch("workOrderItems");

  const totals = useMemo(() => {
    let totalAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const calculatedItems = watchedItems.map((item) => {
      // Use approved quantity if in approval mode, otherwise use qty
      const effectiveQty = isApproval2 ? (item.approved2Qty ?? 0) : isApproval1 ? (item.approved1Qty ?? 0) : (item.qty || 0);
      const base = effectiveQty * (item.rate || 0);
      const c = (base * (item.cgst || 0)) / 100;
      const s = (base * (item.sgst || 0)) / 100;
      const i = (base * (item.igst || 0)) / 100;
      const amt = base + c + s + i;

      totalAmount += amt;
      totalCgst += c;
      totalSgst += s;
      totalIgst += i;

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
  const { data: boqsData } = useSWR<{ data: any[] }>("/api/boqs?perPage=1000", apiGet);

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
                <TextInput label="WO Date" name="workOrderDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">Site</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          options={sitesData?.data?.map((s: any) => ({ label: s.site, value: s.id.toString() })) || []}
                          placeholder="Select Site"
                          disabled={isReadOnly || isApprovalMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="boqId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">BOQ</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          options={boqsData?.data?.map((b: any) => ({ label: b.boqNo, value: b.id.toString() })) || []}
                          placeholder="Select BOQ"
                          disabled={isReadOnly || isApprovalMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
              <FormRow cols={3}>
                <FormField
                  control={form.control}
                  name="subContractorId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">SubContractor</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          options={subContractorsData?.data?.map((sc: any) => ({ label: sc.name, value: sc.id.toString() })) || []}
                          placeholder="Select SubContractor"
                          disabled={isReadOnly || isApprovalMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">Vendor</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          options={vendorsData?.data?.map((v: any) => ({ label: v.vendorName, value: v.id.toString() })) || []}
                          placeholder="Select Vendor"
                          disabled={isReadOnly || isApprovalMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingAddressId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">Billing Address</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          options={billingData?.data?.map((ba: any) => ({ label: ba.companyName, value: ba.id.toString() })) || []}
                          placeholder="Select Billing Address"
                          disabled={isReadOnly || isApprovalMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
              <FormRow cols={3}>
                <TextInput label="Type of WO" name="typeOfWorkOrder" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <TextInput label="Quotation No" name="quotationNo" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <TextInput label="Quotation Date" name="quotationDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} />
              </FormRow>
            </FormSection>

            <FormSection title="Delivery & Payments" className="mt-6">
              <FormRow cols={3}>
                <TextInput label="Delivery Date" name="deliveryDate" type="date" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <TextInput label="Payment Terms (Days)" name="paymentTermsInDays" type="number" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <MultiSelectInput
                  label="Payment Terms"
                  name="paymentTermIds"
                  control={form.control}
                  disabled={isReadOnly || isApprovalMode}
                  options={paymentTermsData?.data?.map((pt: any) => ({ label: pt.paymentTerm, value: pt.id })) || []}
                />
              </FormRow>
              <FormRow>
                <TextareaInput label="Delivery Schedule" name="deliverySchedule" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <TextareaInput label="Terms & Conditions" name="terms" control={form.control} disabled={isReadOnly || isApprovalMode} />
                <TextareaInput label="Note" name="note" control={form.control} disabled={isReadOnly || isApprovalMode} />
              </FormRow>
            </FormSection>
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header className="flex flex-row items-center justify-between">
            <AppCard.Title>Work Order Items</AppCard.Title>
            {!isReadOnly && !isApprovalMode && (
              <Button type="button" size="sm" onClick={() => append({ unitId: 0, qty: 0, rate: 0, cgst: 0, sgst: 0, igst: 0 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            )}
          </AppCard.Header>
          <AppCard.Content>
            <div className="w-full overflow-x-hidden rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="w-full table-fixed border-collapse bg-transparent text-[11px]">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-950/30">
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-left w-10">#</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-left">Item Description / Particulars</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-left w-20">Unit</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-right w-20">Qty</th>
                    {isApprovalMode && <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-right w-20">Appr Qty</th>}
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-right w-20">Rate</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-right w-16">GST%</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-right w-24">Amount</th>
                    {!isReadOnly && !isApprovalMode && <th className="border border-slate-200 dark:border-slate-700 px-1 py-1 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <Fragment key={field.id}>
                      <tr className={index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30 hover:bg-sky-50/60 dark:hover:bg-slate-800/40" : "bg-white dark:bg-slate-900 hover:bg-sky-50/60 dark:hover:bg-slate-800/40"}>
                        <td rowSpan={2} className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top text-center font-medium">
                          {index + 1}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top space-y-2">
                          <TextInput name={`workOrderItems.${index}.item`} placeholder="Item Description" control={form.control} disabled={isReadOnly || isApprovalMode} className="h-7 text-[11px]" />
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top">
                          <AppSelect name={`workOrderItems.${index}.unitId`} control={form.control} disabled={isReadOnly || isApprovalMode} className="h-7 text-[11px]">
                            {unitsData?.data?.map((u: any) => <AppSelect.Item key={u.id} value={u.id.toString()}>{u.unitName}</AppSelect.Item>)}
                          </AppSelect>
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top">
                          <Input type="number" {...form.register(`workOrderItems.${index}.qty`)} className="h-7 text-right w-full text-[11px]" disabled={isReadOnly || isApprovalMode} />
                        </td>
                        {isApprovalMode && (
                          <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top">
                            <Input type="number" {...form.register(`workOrderItems.${index}.${isApproval1 ? "approved1Qty" : "approved2Qty"}`)} className="h-7 text-right w-full text-[11px]" />
                          </td>
                        )}
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top">
                          <Input type="number" {...form.register(`workOrderItems.${index}.rate`)} className="h-7 text-right w-full text-[11px]" disabled={isReadOnly || isApprovalMode} />
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top space-y-1">
                          <Input type="number" {...form.register(`workOrderItems.${index}.cgst`)} placeholder="C%" className="h-6 text-right w-full text-[10px]" disabled={isReadOnly || isApprovalMode} />
                          <Input type="number" {...form.register(`workOrderItems.${index}.sgst`)} placeholder="S%" className="h-6 text-right w-full text-[10px]" disabled={isReadOnly || isApprovalMode} />
                          <Input type="number" {...form.register(`workOrderItems.${index}.igst`)} placeholder="I%" className="h-6 text-right w-full text-[10px]" disabled={isReadOnly || isApprovalMode} />
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top text-right font-medium">
                          {totals.calculatedItems[index]?.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        {!isReadOnly && !isApprovalMode && (
                          <td rowSpan={2} className="border border-slate-200 dark:border-slate-700 px-1 py-2 align-top text-center">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive h-7 w-7">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                      <tr className={index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30 hover:bg-sky-50/60 dark:hover:bg-slate-800/40 border-t-0" : "bg-white dark:bg-slate-900 hover:bg-sky-50/60 dark:hover:bg-slate-800/40 border-t-0"}>
                        <td colSpan={isApprovalMode ? 6 : 5} className="border border-slate-200 dark:border-slate-700 px-1 py-1 align-top border-t-0">
                          <div className="flex gap-2 items-center">
                            <TextInput name={`workOrderItems.${index}.particulars`} placeholder="Particulars / Remarks" control={form.control} disabled={isReadOnly || isApprovalMode} className="h-6 text-[10px] flex-1" />
                            <TextInput name={`workOrderItems.${index}.sacCode`} placeholder="SAC Code" control={form.control} disabled={isReadOnly || isApprovalMode} className="h-6 text-[10px] w-24" />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

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
          <AppButton variant="outline" type="button" onClick={() => router.back()}>
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
