"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppSelect } from "@/components/common/app-select";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import useSWR from "swr";
import {
  WorkOrderBill,
  CreateWorkOrderBillData,
  UpdateWorkOrderBillData,
} from "@/types/work-order-bills";

type WorkOrderSummary = {
  id: number;
  workOrderNo: string;
  workOrderDate: string;
  paymentTermsInDays: number | null;
  vendor?: { vendorName: string } | null;
  site?: { site: string } | null;
};

export interface WorkOrderBillFormInitialData {
  id?: number;
  workOrderId?: number;
  billNo?: string;
  billDate?: string;
  billAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  dueDate?: string;
  paymentDate?: string;
  paymentMode?: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  deductionTax?: number;
  status?: "PAID" | "UNPAID" | "PARTIALLY_PAID";
}

export interface WorkOrderBillFormProps {
  mode: "create" | "edit";
  initial?: WorkOrderBillFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function WorkOrderBillForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess,
  mutate,
}: WorkOrderBillFormProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration(
    "work-order-bills-list"
  );

  const baseSchema = z.object({
    workOrderId: z.coerce
      .number({ required_error: "Work Order is required" })
      .min(1, "Work Order is required"),
    billNo: z.string().min(1, "Bill No. is required"),
    billDate: z.string().min(1, "Bill date is required"),
    billAmount: z.coerce
      .number({ required_error: "Bill amount is required" })
      .min(0, "Must be non-negative"),
    paidAmount: z.coerce.number().min(0, "Must be non-negative").default(0),
    dueAmount: z.coerce.number().default(0),
    dueDate: z.string().min(1, "Due date is required"),
    paymentDate: z.string().min(1, "Payment date is required"),
    paymentMode: z.enum(["CASH", "UPI", "BANK"]),
    chequeNo: z.string().nullable().optional(),
    chequeDate: z.string().nullable().optional(),
    utrNo: z.string().nullable().optional(),
    bankName: z.string().nullable().optional(),
    deductionTax: z.coerce.number().min(0).default(0),
    status: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]),
    remarks: z.string().optional(),
  });

  const schema = baseSchema.superRefine((values, ctx) => {
    if (values.paymentMode === "UPI" && (!values.utrNo || !values.utrNo.trim())) {
      ctx.addIssue({
        path: ["utrNo"],
        code: z.ZodIssueCode.custom,
        message: "UTR No. is required for UPI payments",
      });
    }

    if (values.paymentMode === "BANK") {
      if (!values.bankName || !values.bankName.trim()) {
        ctx.addIssue({
          path: ["bankName"],
          code: z.ZodIssueCode.custom,
          message: "Bank name is required for bank payments",
        });
      }

      if (!values.chequeNo || !values.chequeNo.trim()) {
        ctx.addIssue({
          path: ["chequeNo"],
          code: z.ZodIssueCode.custom,
          message: "Cheque number is required for bank payments",
        });
      }

      if (!values.chequeDate || !values.chequeDate.trim()) {
        ctx.addIssue({
          path: ["chequeDate"],
          code: z.ZodIssueCode.custom,
          message: "Cheque date is required for bank payments",
        });
      }
    }
  });

  type FormValues = z.infer<typeof schema>;

  const qpWorkOrderId = sp?.get("workOrderId");
  const defaultWoId = qpWorkOrderId ? parseInt(qpWorkOrderId) : undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      workOrderId: initial?.workOrderId ?? defaultWoId ?? undefined,
      billNo: initial?.billNo ?? "",
      billDate: initial?.billDate ?? "",
      billAmount: initial?.billAmount ?? 0,
      paidAmount: initial?.paidAmount ?? 0,
      dueAmount: initial?.dueAmount ?? 0,
      dueDate: initial?.dueDate ?? "",
      paymentDate: initial?.paymentDate ?? "",
      paymentMode: (initial?.paymentMode as any) ?? "CASH",
      chequeNo: initial?.chequeNo ?? null,
      chequeDate: initial?.chequeDate ?? null,
      utrNo: initial?.utrNo ?? null,
      bankName: initial?.bankName ?? null,
      deductionTax: initial?.deductionTax ?? 0,
      status: initial?.status ?? "UNPAID",
      remarks: undefined,
    },
  });

  const { control, handleSubmit, reset } = form;
  const isCreate = mode === "create";

  // No work order selector; workOrderId comes from query/initial

  // Fetch current Work Order basic info to compute due date and display info
  const currentWorkOrderId = initial?.workOrderId ?? defaultWoId;

  const { data: woDetail, error: woError } = useSWR<WorkOrderSummary>(
    currentWorkOrderId ? `/api/work-orders/${currentWorkOrderId}` : null,
    apiGet
  );

  // Helper to add N days to YYYY-MM-DD
  function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
    const base = new Date(y, (m || 1) - 1, d || 1);
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Auto-calc due date when billDate or paymentTerms change
  const billDateVal = form.watch("billDate");
  useEffect(() => {
    const terms = woDetail?.paymentTermsInDays;

    if (billDateVal && typeof terms === "number" && !Number.isNaN(terms)) {
      const due = addDays(billDateVal, terms);
      form.setValue("dueDate", due, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [billDateVal, woDetail?.paymentTermsInDays]);

  const billAmountVal = form.watch("billAmount");
  const paidAmountVal = form.watch("paidAmount");
  const deductionTaxVal = form.watch("deductionTax");

  useEffect(() => {
    const bill = Number(billAmountVal) || 0;
    const paid = Number(paidAmountVal) || 0;
    const deduction = Number(deductionTaxVal) || 0;
    const due = bill - paid - deduction;
    form.setValue("dueAmount", due, {
      shouldValidate: true,
    });
  }, [billAmountVal, paidAmountVal, deductionTaxVal, form]);

  const onSubmit = async (formData: FormValues) => {
    setSubmitting(true);
    try {
      let res;
      if (mode === "create") {
        // Normalize dependent fields based on payment mode
        const pm = formData.paymentMode;
        const normalized = {
          chequeNo: pm === "BANK" ? formData.chequeNo ?? null : null,
          chequeDate: pm === "BANK" ? formData.chequeDate ?? null : null,
          bankName: pm === "BANK" ? formData.bankName ?? null : null,
          utrNo: pm === "UPI" ? formData.utrNo ?? null : null,
        };
        const computedDue =
          (formData.billAmount ?? 0) -
          (formData.paidAmount ?? 0) -
          (formData.deductionTax ?? 0);
        const payload: CreateWorkOrderBillData = {
          workOrderId: formData.workOrderId,
          billNo: formData.billNo,
          billDate: formData.billDate,
          billAmount: formData.billAmount,
          paidAmount: formData.paidAmount,
          dueAmount: computedDue,
          dueDate: formData.dueDate,
          paymentDate: formData.paymentDate,
          paymentMode: formData.paymentMode,
          chequeNo: normalized.chequeNo,
          chequeDate: normalized.chequeDate,
          utrNo: normalized.utrNo,
          bankName: normalized.bankName,
          deductionTax: formData.deductionTax ?? 0,
          status: formData.status,
        };
        res = await apiPost("/api/work-order-bills", payload);
        toast.success("Work order bill created successfully");
        reset({
          workOrderId: initial?.workOrderId ?? defaultWoId ?? undefined,
          billNo: "",
          billDate: "",
          billAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          dueDate: "",
          paymentDate: "",
          paymentMode: "CASH",
          chequeNo: null,
          chequeDate: null,
          utrNo: null,
          bankName: null,
          deductionTax: 0,
          status: "UNPAID",
          remarks: undefined,
        });
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const pm = formData.paymentMode;
        const normalized = {
          chequeNo: pm === "BANK" ? formData.chequeNo ?? null : null,
          chequeDate: pm === "BANK" ? formData.chequeDate ?? null : null,
          bankName: pm === "BANK" ? formData.bankName ?? null : null,
          utrNo: pm === "UPI" ? formData.utrNo ?? null : null,
        };
        const computedDue =
          (formData.billAmount ?? 0) -
          (formData.paidAmount ?? 0) -
          (formData.deductionTax ?? 0);
        const payload: UpdateWorkOrderBillData = {
          workOrderId: formData.workOrderId,
          billNo: formData.billNo,
          billDate: formData.billDate,
          billAmount: formData.billAmount,
          paidAmount: formData.paidAmount,
          dueAmount: computedDue,
          dueDate: formData.dueDate,
          paymentDate: formData.paymentDate,
          paymentMode: formData.paymentMode,
          chequeNo: normalized.chequeNo,
          chequeDate: normalized.chequeDate,
          utrNo: normalized.utrNo,
          bankName: normalized.bankName,
          deductionTax: formData.deductionTax ?? 0,
          status: formData.status,
        };
        res = await apiPatch(`/api/work-order-bills/${initial.id}`, payload);
        toast.success("Work order bill updated successfully");
        onSuccess?.(res);
      }

      if (mutate) {
        await mutate();
      }

      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save work order bill");
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMode = form.watch("paymentMode");

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Work Order Bill" : "Edit Work Order Bill"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new bill for a work order."
              : "Update work order bill."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            {/* Work Order summary */}
            {woDetail && (
              <div className="mb-4 rounded-md border p-3 text-sm grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">WO No.</div>
                  <div className="font-medium">{woDetail.workOrderNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vendor</div>
                  <div className="font-medium">
                    {woDetail.vendor?.vendorName || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Site</div>
                  <div className="font-medium">
                    {woDetail.site?.site || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">WO Date</div>
                  <div className="font-medium">
                    {woDetail.workOrderDate?.slice(0, 10)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment Terms</div>
                  <div className="font-medium">
                    {woDetail.paymentTermsInDays ?? 0} days
                  </div>
                </div>
              </div>
            )}
            <FormSection legend="Bill Information">
              {/* Row 1: Bill No, Bill Date, Bill Amount */}
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="billNo"
                  label="Bill No."
                  required
                />
                <TextInput
                  control={control}
                  name="billDate"
                  label="Bill Date"
                  type="date"
                  required
                  onInput={(e) => {
                    const val = (e as React.FormEvent<HTMLInputElement>)
                      .currentTarget.value;
                    const terms = woDetail?.paymentTermsInDays;

                    if (
                      val &&
                      typeof terms === "number" &&
                      Number.isFinite(terms)
                    ) {
                      const due = addDays(val, terms);
                      form.setValue("dueDate", due, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }
                  }}
                />
                <TextInput
                  control={control}
                  name="billAmount"
                  label="Bill Amount"
                  required
                />
              </FormRow>
              {/* Row 2: Due Date (auto), Payment Date, Payment Mode */}
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="dueDate"
                  label="Due Date"
                  type="date"
                  disabled
                  required
                />
                <TextInput
                  control={control}
                  name="paymentDate"
                  label="Payment Date"
                  type="date"
                  required
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Mode</label>
                  <AppSelect
                    value={paymentMode}
                    onValueChange={(v) => {
                      if (v === "CASH") {
                        form.setValue("bankName", null, {
                          shouldValidate: true,
                        });
                        form.setValue("chequeNo", null, {
                          shouldValidate: true,
                        });
                        form.setValue("chequeDate", null, {
                          shouldValidate: true,
                        });
                        form.setValue("utrNo", null, { shouldValidate: true });
                      } else if (v === "UPI") {
                        form.setValue("bankName", null, {
                          shouldValidate: true,
                        });
                        form.setValue("chequeNo", null, {
                          shouldValidate: true,
                        });
                        form.setValue("chequeDate", null, {
                          shouldValidate: true,
                        });
                      } else if (v === "BANK") {
                        form.setValue("utrNo", null, { shouldValidate: true });
                      }
                      form.setValue("paymentMode", v as any, {
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Select Payment Mode"
                  >
                    <AppSelect.Item value="CASH">Cash</AppSelect.Item>
                    <AppSelect.Item value="UPI">UPI</AppSelect.Item>
                    <AppSelect.Item value="BANK">Bank</AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>
              {/* Conditional fields based on payment mode */}
              {paymentMode === "BANK" && (
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="bankName"
                    label="Bank Name"
                  />
                  <TextInput
                    control={control}
                    name="chequeNo"
                    label="Cheque No."
                  />
                  <TextInput
                    control={control}
                    name="chequeDate"
                    label="Cheque Date"
                    type="date"
                  />
                </FormRow>
              )}
              {paymentMode === "UPI" && (
                <FormRow cols={1}>
                  <TextInput control={control} name="utrNo" label="UTR No." />
                </FormRow>
              )}
              {/* Row 3: Deduction/Tax, Paid Amount, Status */}
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="deductionTax"
                  label="Deduction / Tax"
                />
                <TextInput
                  control={control}
                  name="paidAmount"
                  label="Paid Amount"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <AppSelect
                    value={form.watch("status")}
                    onValueChange={(v) =>
                      form.setValue("status", v as any, {
                        shouldValidate: true,
                      })
                    }
                    placeholder="Select Status"
                  >
                    <AppSelect.Item value="UNPAID">Unpaid</AppSelect.Item>
                    <AppSelect.Item value="PAID">Paid</AppSelect.Item>
                    <AppSelect.Item value="PARTIALLY_PAID">
                      Partially Paid
                    </AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={backWithScrollRestore}
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
              {isCreate ? "Create Bill" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default WorkOrderBillForm;
