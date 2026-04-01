"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection, FormRow } from "@/components/common/app-form";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppCombobox } from "@/components/common/app-combobox";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Trash2, ArrowLeft, Minus } from "lucide-react";

type Site = {
  id: number;
  site: string;
};

type SubContractorWorkOrder = {
  id: number;
  workOrderNo: string;
  siteId: number;
  subContractorId: number;
  subContractor: {
    id: number;
    name: string;
  };
  vendor?: {
    id: number;
    vendorName: string;
    gstNumber?: string;
  };
  billingAddress?: {
    id: number;
    companyName: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: { city: string };
    state?: { state: string };
    pincode?: string;
    gstNumber?: string;
  };
  subContractorWorkOrderDetails: Array<{
    id: number;
    item: string;
    sacCode?: string;
    unit?: { id: number; unitName: string };
    qty: number;
    executedQty: number;
    rate: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  }>;
};

type InvoiceItem = {
  id?: number;
  subContractorWorkOrderDetailId: number;
  subContractorWorkOrderDetail?: SubContractorWorkOrder["subContractorWorkOrderDetails"][0];
  particulars: string;
  workOrderQty: number;
  currentBillQty: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  cgstPercent: number;
  sgstpercent: number;
  igstPercent: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  totalLineAmount: number;
};

type InvoiceFormInitialData = {
  id?: number;
  invoiceNumber?: string;
  revision?: string;
  invoiceDate?: string;
  fromDate?: string;
  toDate?: string;
  siteId?: number;
  subcontractorWorkOrderId?: number;
  grossAmount?: number;
  retentionAmount?: number;
  tds?: number;
  lwf?: number;
  otherDeductions?: number;
  netPayable?: number;
  status?: string;
  invoiceItems?: InvoiceItem[];
};

export type InvoiceFormMode = "create" | "edit" | "view";

export interface SubContractorInvoiceFormProps {
  mode: InvoiceFormMode;
  id?: number;
  initial?: InvoiceFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const invoiceItemSchema = z.object({
  subContractorWorkOrderDetailId: z.coerce.number().min(1, "Work Order Item is required"),
  particulars: z.string().min(1, "Particulars are required"),
  workOrderQty: z.coerce.number().min(0),
  currentBillQty: z.coerce.number().min(0.0001, "Current Bill Qty must be greater than 0"),
  rate: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  discountAmount: z.coerce.number().default(0),
  cgstPercent: z.coerce.number().min(0).max(100).default(0),
  sgstpercent: z.coerce.number().min(0).max(100).default(0),
  igstPercent: z.coerce.number().min(0).max(100).default(0),
  cgstAmt: z.coerce.number().default(0),
  sgstAmt: z.coerce.number().default(0),
  igstAmt: z.coerce.number().default(0),
  totalLineAmount: z.coerce.number(),
});

const createInputSchema = z.object({
  invoiceDate: z.string().min(1, "Invoice date is required"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  siteId: z.coerce.number().min(1, "Site is required"),
  subcontractorWorkOrderId: z.coerce.number().min(1, "Work Order is required"),
  invoiceNumber: z.string().min(1, "Invoice Number is required"),
  grossAmount: z.coerce.number().min(0),
  retentionAmount: z.coerce.number().default(0),
  tds: z.coerce.number().default(0),
  lwf: z.coerce.number().default(0),
  otherDeductions: z.coerce.number().default(0),
  netPayable: z.coerce.number().min(0),
  invoiceItems: z.array(invoiceItemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof createInputSchema>;

export function SubContractorInvoiceForm({
  mode,
  id,
  initial,
  onSuccess,
  redirectOnSuccess = "/sub-contractor-invoices",
}: SubContractorInvoiceFormProps) {
  const router = useRouter();
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  const { data: sitesData } = useSWR<{ data: Site[] }>("/api/sites?perPage=1000", apiGet);
  const sites = sitesData?.data || [];

  const { data: workOrdersData } = useSWR<{ data: SubContractorWorkOrder[] }>(
    "/api/sub-contractor-work-orders?perPage=1000",
    apiGet
  );
  const workOrders = workOrdersData?.data || [];

  const { data: existingInvoice } = useSWR(
    isEdit && id ? `/api/sub-contractor-invoices/${id}` : null,
    apiGet
  );

  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema),
    defaultValues: {
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      fromDate: "",
      toDate: "",
      siteId: initial?.siteId || 0,
      subcontractorWorkOrderId: 0,
      invoiceNumber: "",
      grossAmount: 0,
      retentionAmount: 0,
      tds: 0,
      lwf: 0,
      otherDeductions: 0,
      netPayable: 0,
      invoiceItems: [],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invoiceItems",
  });

  const selectedSiteId = form.watch("siteId");
  const selectedWorkOrderId = form.watch("subcontractorWorkOrderId");
  const invoiceItems = form.watch("invoiceItems");

  // Fetch full work order details when selected (to get subContractorWorkOrderDetails)
  const { data: selectedWorkOrderData } = useSWR(
    selectedWorkOrderId ? `/api/sub-contractor-work-orders/${selectedWorkOrderId}` : null,
    apiGet
  );
  const selectedWorkOrderFull = (selectedWorkOrderData as any)?.data || null;

  const selectedWorkOrder = useMemo(() => {
    // Use the full work order data if available, otherwise fallback to list data
    return selectedWorkOrderFull || workOrders.find((wo) => wo.id === selectedWorkOrderId);
  }, [workOrders, selectedWorkOrderId, selectedWorkOrderFull]);

  // Work order items for select dropdown
  const workOrderItemsForSelect = useMemo(() => {
    const details = selectedWorkOrderFull?.subContractorWorkOrderDetails || [];
    return details.map((d: any) => ({ value: String(d.id), label: d.item }));
  }, [selectedWorkOrderFull]);

  // Helper to add new item (empty fields, will save as null/0)
  const addItem = () => {
    append({
      subContractorWorkOrderDetailId: 0,
      particulars: "",
      workOrderQty: undefined as any,
      currentBillQty: undefined as any,
      rate: undefined as any,
      discountPercent: undefined as any,
      discountAmount: undefined as any,
      cgstPercent: undefined as any,
      sgstpercent: undefined as any,
      igstPercent: undefined as any,
      cgstAmt: undefined as any,
      sgstAmt: undefined as any,
      igstAmt: undefined as any,
      totalLineAmount: undefined as any,
    });
  };

  // Decimal regex for 2 decimal places
  const decimalRegex2 = /^\d*(?:\.\d{0,2})?$/;
  const handleDecimalChange2 = (path: any) => (value: string) => {
    if (value === "" || decimalRegex2.test(value)) {
      form.setValue(path, value as any, { shouldDirty: true, shouldValidate: true });
    }
  };

  // Computed items for display
  const computedItems = useMemo(() => {
    if (!invoiceItems) return [];
    const workOrderDetails = selectedWorkOrderFull?.subContractorWorkOrderDetails || [];

    return invoiceItems.map((item) => {
      const workOrderDetail = workOrderDetails.find(
        (d: any) => d.id === item.subContractorWorkOrderDetailId
      );

      const qty = Number(item.currentBillQty) || 0;
      const rate = Number(item.rate) || 0;
      const discountPercent = Number(item.discountPercent) || 0;

      const baseAmount = qty * rate;
      const discountAmount = (baseAmount * discountPercent) / 100;
      const taxableAmount = baseAmount - discountAmount;

      const cgstPercent = Number(item.cgstPercent) || 0;
      const sgstPercent = Number(item.sgstpercent) || 0;
      const igstPercent = Number(item.igstPercent) || 0;

      const cgstAmt = (taxableAmount * cgstPercent) / 100;
      const sgstAmt = (taxableAmount * sgstPercent) / 100;
      const igstAmt = (taxableAmount * igstPercent) / 100;

      const totalLineAmount = taxableAmount + cgstAmt + sgstAmt + igstAmt;

      return {
        ...item,
        workOrderQty: workOrderDetail ? Number(workOrderDetail.qty) : item.workOrderQty,
        discountAmount,
        cgstAmt,
        sgstAmt,
        igstAmt,
        totalLineAmount,
      };
    });
  }, [invoiceItems, selectedWorkOrderFull]);

  // Item totals
  const itemTotals = useMemo(() => {
    return computedItems.reduce(
      (acc, item) => ({
        amount: acc.amount + (item.totalLineAmount || 0),
        cgstAmt: acc.cgstAmt + (item.cgstAmt || 0),
        sgstAmt: acc.sgstAmt + (item.sgstAmt || 0),
        igstAmt: acc.igstAmt + (item.igstAmt || 0),
        discountAmount: acc.discountAmount + (item.discountAmount || 0),
        taxableAmount: acc.taxableAmount + ((item.totalLineAmount || 0) - (item.cgstAmt || 0) - (item.sgstAmt || 0) - (item.igstAmt || 0)),
      }),
      {
        amount: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        igstAmt: 0,
        discountAmount: 0,
        taxableAmount: 0,
      }
    );
  }, [computedItems]);

  // Format amount helper
  const formatAmount = (value: number | undefined | null): string => {
    const amount = Number.isFinite(value as number) ? (value as number) : 0;
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Derived values for totals display
  const grossAmount = itemTotals.amount;
  const deductionsTotal = 
    Number(form.watch("retentionAmount") || 0) + 
    Number(form.watch("tds") || 0) + 
    Number(form.watch("lwf") || 0) + 
    Number(form.watch("otherDeductions") || 0);
  const netPayable = Math.max(0, grossAmount - deductionsTotal);

  const filteredWorkOrders = useMemo(() => {
    if (!selectedSiteId) return [];
    return workOrders.filter((wo) => wo.siteId === selectedSiteId);
  }, [workOrders, selectedSiteId]);

  // Pre-fill work order details when work order is selected
  useEffect(() => {
    if (selectedWorkOrderFull && isCreate && fields.length === 0) {
      const details = selectedWorkOrderFull.subContractorWorkOrderDetails || [];
      if (details.length > 0) {
        const items = details.map((detail: any) => ({
          subContractorWorkOrderDetailId: detail.id,
          particulars: detail.item,
          workOrderQty: Number(detail.qty),
          currentBillQty: 0,
          rate: Number(detail.rate),
          discountPercent: 0,
          discountAmount: 0,
          cgstPercent: Number(detail.cgst) || 0,
          sgstpercent: Number(detail.sgst) || 0,
          igstPercent: Number(detail.igst) || 0,
          cgstAmt: 0,
          sgstAmt: 0,
          igstAmt: 0,
          totalLineAmount: 0,
        }));

        if (items.length > 0) {
          form.setValue("invoiceItems", items);
        }
      }
    }
  }, [selectedWorkOrderFull, isCreate, form, fields.length]);

  // Calculate amounts when items change
  useEffect(() => {
    if (!invoiceItems || invoiceItems.length === 0) return;

    const workOrderDetails = selectedWorkOrderFull?.subContractorWorkOrderDetails || [];

    let grossAmount = 0;
    const updatedItems = invoiceItems.map((item, idx) => {
      const workOrderDetail = workOrderDetails.find(
        (d: any) => d.id === item.subContractorWorkOrderDetailId
      );

      const qty = Number(item.currentBillQty) || 0;
      const rate = Number(item.rate) || 0;
      const discountPercent = Number(item.discountPercent) || 0;

      const baseAmount = qty * rate;
      const discountAmount = (baseAmount * discountPercent) / 100;
      const taxableAmount = baseAmount - discountAmount;

      const cgstPercent = Number(item.cgstPercent) || 0;
      const sgstPercent = Number(item.sgstpercent) || 0;
      const igstPercent = Number(item.igstPercent) || 0;

      const cgstAmt = (taxableAmount * cgstPercent) / 100;
      const sgstAmt = (taxableAmount * sgstPercent) / 100;
      const igstAmt = (taxableAmount * igstPercent) / 100;

      const totalLineAmount = taxableAmount + cgstAmt + sgstAmt + igstAmt;

      grossAmount += totalLineAmount;

      return {
        ...item,
        workOrderQty: workOrderDetail ? Number(workOrderDetail.qty) : item.workOrderQty,
        discountAmount,
        cgstAmt,
        sgstAmt,
        igstAmt,
        totalLineAmount,
      };
    });

    // Update form values if calculated amounts changed
    const currentGross = form.getValues("grossAmount");
    if (Math.abs(currentGross - grossAmount) > 0.01) {
      form.setValue("grossAmount", grossAmount);

      const retentionAmount = Number(form.getValues("retentionAmount")) || 0;
      const tds = Number(form.getValues("tds")) || 0;
      const lwf = Number(form.getValues("lwf")) || 0;
      const otherDeductions = Number(form.getValues("otherDeductions")) || 0;

      const netPayable = grossAmount - retentionAmount - tds - lwf - otherDeductions;
      form.setValue("netPayable", Math.max(0, netPayable));

      // Update individual items if their calculated values changed
      updatedItems.forEach((item, idx) => {
        const currentItem = invoiceItems[idx];
        if (currentItem) {
          if (Math.abs((currentItem.totalLineAmount || 0) - item.totalLineAmount) > 0.01) {
            form.setValue(`invoiceItems.${idx}.totalLineAmount`, item.totalLineAmount);
          }
          if (Math.abs((currentItem.discountAmount || 0) - item.discountAmount) > 0.01) {
            form.setValue(`invoiceItems.${idx}.discountAmount`, item.discountAmount);
          }
          if (Math.abs((currentItem.cgstAmt || 0) - item.cgstAmt) > 0.01) {
            form.setValue(`invoiceItems.${idx}.cgstAmt`, item.cgstAmt);
          }
          if (Math.abs((currentItem.sgstAmt || 0) - item.sgstAmt) > 0.01) {
            form.setValue(`invoiceItems.${idx}.sgstAmt`, item.sgstAmt);
          }
          if (Math.abs((currentItem.igstAmt || 0) - item.igstAmt) > 0.01) {
            form.setValue(`invoiceItems.${idx}.igstAmt`, item.igstAmt);
          }
        }
      });
    }
  }, [invoiceItems, selectedWorkOrderFull, form]);

  // Calculate net payable when deductions change
  useEffect(() => {
    const grossAmount = Number(form.getValues("grossAmount")) || 0;
    const retentionAmount = Number(form.getValues("retentionAmount")) || 0;
    const tds = Number(form.getValues("tds")) || 0;
    const lwf = Number(form.getValues("lwf")) || 0;
    const otherDeductions = Number(form.getValues("otherDeductions")) || 0;

    const netPayable = grossAmount - retentionAmount - tds - lwf - otherDeductions;
    form.setValue("netPayable", Math.max(0, netPayable));
  }, [
    form.watch("grossAmount"),
    form.watch("retentionAmount"),
    form.watch("tds"),
    form.watch("lwf"),
    form.watch("otherDeductions"),
  ]);

  // Load existing data when editing
  useEffect(() => {
    if (isEdit && existingInvoice) {
      const invoice = existingInvoice as any;
      form.reset({
        invoiceDate: format(new Date(invoice.invoiceDate), "yyyy-MM-dd"),
        fromDate: invoice.fromDate ? format(new Date(invoice.fromDate), "yyyy-MM-dd") : "",
        toDate: invoice.toDate ? format(new Date(invoice.toDate), "yyyy-MM-dd") : "",
        siteId: invoice.siteId,
        subcontractorWorkOrderId: invoice.subcontractorWorkOrderId,
        invoiceNumber: invoice.invoiceNumber,
        grossAmount: Number(invoice.grossAmount) || 0,
        retentionAmount: Number(invoice.retentionAmount) || 0,
        tds: Number(invoice.tds) || 0,
        lwf: Number(invoice.lwf) || 0,
        otherDeductions: Number(invoice.otherDeductions) || 0,
        netPayable: Number(invoice.netPayable) || 0,
        invoiceItems: invoice.subContractorInvoiceDetails?.map((item: any) => ({
          id: item.id,
          subContractorWorkOrderDetailId: item.subContractorWorkOrderDetailId,
          particulars: item.particulars,
          workOrderQty: Number(item.workOrderQty),
          currentBillQty: Number(item.currentBillQty),
          rate: Number(item.rate),
          discountPercent: Number(item.discountPercent) || 0,
          discountAmount: Number(item.discountAmount) || 0,
          cgstPercent: Number(item.cgstPercent) || 0,
          sgstpercent: Number(item.sgstpercent) || 0,
          igstPercent: Number(item.igstPercent) || 0,
          cgstAmt: Number(item.cgstAmt) || 0,
          sgstAmt: Number(item.sgstAmt) || 0,
          igstAmt: Number(item.igstAmt) || 0,
          totalLineAmount: Number(item.totalLineAmount),
        })) || [],
      });
    }
  }, [isEdit, existingInvoice, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        ...data,
        invoiceDate: new Date(data.invoiceDate).toISOString(),
        fromDate: data.fromDate ? new Date(data.fromDate).toISOString() : null,
        toDate: data.toDate ? new Date(data.toDate).toISOString() : null,
      };

      if (isCreate) {
        await apiPost("/api/sub-contractor-invoices", payload);
        toast.success("Invoice created successfully");
      } else if (isEdit && id) {
        await apiPatch(`/api/sub-contractor-invoices/${id}`, payload);
        toast.success("Invoice updated successfully");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save invoice");
    }
  });

  const onError = (errors: any) => {
    console.log("Form errors:", errors);
    toast.error("Please fix the form errors before submitting");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AppButton variant="outline" size="icon" onClick={() => router.push("/sub-contractor-invoices")} className="text-black dark:text-white">
            <ArrowLeft className="h-4 w-4" />
          </AppButton>
          <h1 className="text-2xl font-bold">
            {isCreate ? "New Sub Contractor Invoice" : isEdit ? "Edit Invoice" : "View Invoice"}
          </h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} onError={onError} className="space-y-6">
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Invoice Details</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <FormSection>
                <FormRow cols={3}>
                  <FormField
                    control={form.control}
                    name="siteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site</FormLabel>
                        <FormControl>
                          <AppCombobox
                            value={field.value?.toString()}
                            onValueChange={(val) => field.onChange(parseInt(val) || 0)}
                            disabled={isView || isEdit}
                            options={sites.map((s) => ({ value: s.id.toString(), label: s.site }))}
                            placeholder="Select site"
                            emptyText="No sites found"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcontractorWorkOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Order</FormLabel>
                        <FormControl>
                          <AppCombobox
                            value={field.value?.toString()}
                            onValueChange={(val) => field.onChange(parseInt(val) || 0)}
                            disabled={isView || isEdit || !selectedSiteId}
                            options={filteredWorkOrders.map((wo) => ({
                              value: wo.id.toString(),
                              label: `${wo.workOrderNo} - ${wo.subContractor.name}`,
                            }))}
                            placeholder={selectedSiteId ? "Select work order" : "Select site first"}
                            emptyText="No work orders found for this site"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <TextInput
                      control={form.control}
                      name="invoiceNumber"
                      label="Invoice Number"
                      placeholder="Enter invoice number"
                      disabled={isView}
                    />
                  </div>
                  <div>
                    <TextInput
                      control={form.control}
                      name="invoiceDate"
                      label="Invoice Date"
                      type="date"
                      disabled={isView}
                    />
                  </div>
                  <div>
                    <TextInput
                      control={form.control}
                      name="fromDate"
                      label="From Date"
                      type="date"
                      disabled={isView}
                    />
                  </div>
                  <div>
                    <TextInput
                      control={form.control}
                      name="toDate"
                      label="To Date"
                      type="date"
                      disabled={isView}
                    />
                  </div>
                </FormRow>
              </FormSection>
            </AppCard.Content>
          </AppCard>

          {/* Combined Invoice Items & Totals Card */}
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Invoice Items & Totals</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              {/* Items Section - Table Style like Sales Invoice */}
              <div className="w-full overflow-x-auto rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full border-collapse bg-transparent text-[11px]">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-700">
                      {!isView && <th className="w-10 px-2 py-2 text-center border-r border-slate-200 dark:border-slate-700"></th>}
                      <th className="px-2 py-2 text-left">Item Details</th>
                      <th className="w-32 px-2 py-2 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const computed = computedItems[index];
                      return (
                        <Fragment key={field.id}>
                          {/* Row 1 - Work Order Item Selection + Particulars */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                            {!isView && (
                              <td rowSpan={3} className={`border-r border-slate-200 dark:border-slate-700 px-1 py-1 align-top text-center ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => remove(index)}
                                  className="text-destructive h-7 w-7 mt-2"
                                  title="Remove Item"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                            <td className="px-2 py-2 pt-3">
                              <div className="flex gap-4 items-start">
                                <div className="w-48">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.subContractorWorkOrderDetailId`}
                                    render={({ field: woField }) => (
                                      <FormItem>
                                        <label className="text-[10px] font-medium leading-none">Work Order Item</label>
                                        <FormControl>
                                          <AppCombobox
                                            value={woField.value && woField.value > 0 ? String(woField.value) : "__none"}
                                            onValueChange={(val) => {
                                              const parsed = val === "__none" ? 0 : parseInt(val, 10);
                                              woField.onChange(parsed);
                                              const workOrderDetails = selectedWorkOrderFull?.subContractorWorkOrderDetails || [];
                                              const selectedItem = workOrderDetails.find((it: any) => it.id === parsed);
                                              if (selectedItem) {
                                                form.setValue(`invoiceItems.${index}.particulars`, selectedItem.item || "");
                                                form.setValue(`invoiceItems.${index}.rate`, selectedItem.rate);
                                                form.setValue(`invoiceItems.${index}.workOrderQty`, selectedItem.qty);
                                                form.setValue(`invoiceItems.${index}.cgstPercent`, selectedItem.cgst || 0);
                                                form.setValue(`invoiceItems.${index}.sgstpercent`, selectedItem.sgst || 0);
                                                form.setValue(`invoiceItems.${index}.igstPercent`, selectedItem.igst || 0);
                                              }
                                            }}
                                            options={selectedWorkOrderId ? [{ value: "__none", label: "Select Item" }, ...workOrderItemsForSelect] : [{ value: "__none", label: "Select WO first" }]}
                                            placeholder={selectedWorkOrderId ? "Select Item" : "Select WO first"}
                                            searchPlaceholder="Search item..."
                                            emptyText="No item found."
                                            disabled={isView || !selectedWorkOrderId}
                                            className="w-full"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <TextareaInput
                                    name={`invoiceItems.${index}.particulars`}
                                    control={form.control}
                                    label="Particulars"
                                    disabled={isView}
                                    className="h-14 text-[11px]"
                                    itemClassName="m-0"
                                  />
                                </div>
                              </div>
                            </td>
                            <td rowSpan={3} className={`border-l border-slate-200 dark:border-slate-700 px-2 py-2 align-middle text-right font-bold text-sm ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                              {computed?.totalLineAmount?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                            </td>
                          </tr>
                          {/* Row 2 - Work Order Qty, Current Bill Qty, Rate, Discount */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                            <td className="px-2 py-2">
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.workOrderQty`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">WO Qty</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right bg-slate-100 dark:bg-slate-800"
                                            disabled={true}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            readOnly
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.currentBillQty`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Current Qty</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === "" || /^\d*(?:\.\d{0,2})?$/.test(val)) {
                                                field.onChange(val);
                                                form.setValue(`invoiceItems.${index}.currentBillQty`, val as any, { shouldDirty: true, shouldValidate: true });
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.rate`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Rate</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`invoiceItems.${index}.rate`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.discountPercent`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Disc %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`invoiceItems.${index}.discountPercent`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.discountAmount > 0 ? `₹${computed.discountAmount.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Row 3 - Taxes */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"} border-b-2 border-slate-300 dark:border-slate-700`}>
                            <td className="px-2 py-2 pb-3">
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.cgstPercent`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">CGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`invoiceItems.${index}.cgstPercent`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.cgstAmt > 0 ? `₹${computed.cgstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.sgstpercent`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">SGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`invoiceItems.${index}.sgstpercent`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.sgstAmt > 0 ? `₹${computed.sgstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`invoiceItems.${index}.igstPercent`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">IGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isView}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`invoiceItems.${index}.igstPercent`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.igstAmt > 0 ? `₹${computed.igstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1"></div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isView && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItem()}
                    disabled={!selectedWorkOrderId}
                    className="text-black dark:text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
              )}

              {/* Deductions & Totals - Right aligned, small text */}
              <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4">
                {/* Taxable Amount */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm">
                  <span className="text-muted-foreground text-[11px]">Taxable Amount:</span>
                  <span className="text-right text-[11px] font-medium">{itemTotals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Total CGST/SGST/IGST */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1">
                  <span className="text-muted-foreground text-[11px]">Total CGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground text-[11px]">Total SGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground text-[11px]">Total IGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Gross Amount */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1 border-t pt-1">
                  <span className="text-muted-foreground text-[11px] font-medium">Gross Amount:</span>
                  <span className="text-right text-[11px] font-medium">{formatAmount(grossAmount)}</span>
                </div>

                {/* Deductions - Input Fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full max-w-xs text-[11px] mt-2">
                  <span className="text-muted-foreground">Retention:</span>
                  <FormField
                    control={form.control}
                    name="retentionAmount"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isView}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("retentionAmount")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">TDS:</span>
                  <FormField
                    control={form.control}
                    name="tds"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isView}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("tds")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">LWF:</span>
                  <FormField
                    control={form.control}
                    name="lwf"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isView}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("lwf")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">Other:</span>
                  <FormField
                    control={form.control}
                    name="otherDeductions"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isView}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("otherDeductions")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Deduction Values Display */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1">
                  {Number(form.watch("retentionAmount")) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less Retention:</span>
                      <span className="text-right text-[11px]">{formatAmount(Number(form.watch("retentionAmount")))}</span>
                    </>
                  )}
                  {Number(form.watch("tds")) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less TDS:</span>
                      <span className="text-right text-[11px]">{formatAmount(Number(form.watch("tds")))}</span>
                    </>
                  )}
                  {Number(form.watch("lwf")) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less LWF:</span>
                      <span className="text-right text-[11px]">{formatAmount(Number(form.watch("lwf")))}</span>
                    </>
                  )}
                  {Number(form.watch("otherDeductions")) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less Other:</span>
                      <span className="text-right text-[11px]">{formatAmount(Number(form.watch("otherDeductions")))}</span>
                    </>
                  )}
                </div>

                {/* Total Deductions */}
                {deductionsTotal > 0 && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1 border-t pt-1">
                    <span className="text-muted-foreground text-[11px] font-medium">Total Deductions:</span>
                    <span className="text-right text-[11px] font-medium">{formatAmount(deductionsTotal)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-2 border-t pt-2">
                  <span className="text-lg font-bold text-[14px]">Net Payable:</span>
                  <span className="text-lg font-bold text-right text-[14px] text-primary">
                    {netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </AppCard.Content>
          </AppCard>

          {!isView && (
            <div className="flex items-center justify-end gap-4">
              <AppButton
                type="button"
                variant="outline"
                onClick={() => router.push("/sub-contractor-invoices")}
                className="text-black dark:text-white"
              >
                Cancel
              </AppButton>
              <AppButton type="submit" iconName="Save">
                {isCreate ? "Create Invoice" : "Update Invoice"}
              </AppButton>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
