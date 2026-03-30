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
  SubContractorWorkOrderBill,
  CreateSubContractorWorkOrderBillData,
  UpdateSubContractorWorkOrderBillData,
} from "@/types/sub-contractor-work-order-bills";

type SubContractorWorkOrderSummary = {
  id: number;
  workOrderNo: string;
  workOrderDate: string;
  paymentTermsInDays: number | null;
  vendor?: { vendorName: string } | null;
  site?: { site: string } | null;
};

export interface SubContractorWorkOrderBillFormInitialData {
  id?: number;
  subContractorWorkOrderId?: number;
  billNo?: string;
  billDate?: string;
  billAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  dueDate?: string;
  paymentDate?: string | null;
  paymentMode?: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  rtgsDate?: string | null;
  neftDate?: string | null;
  transactionNo?: string | null;
  transactionDate?: string | null;
  deductionTax?: number;
  status?: "PAID" | "UNPAID" | "PARTIALLY_PAID";
}

export interface SubContractorWorkOrderBillFormProps {
  mode: "create" | "edit";
  initial?: SubContractorWorkOrderBillFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function SubContractorWorkOrderBillForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess,
  mutate,
}: SubContractorWorkOrderBillFormProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration(
    "sub-contractor-work-order-bills-list"
  );

  const baseSchema = z.object({
    subContractorWorkOrderId: z.coerce
      .number({ required_error: "Sub contractor work order is required" })
      .min(1, "Sub contractor work order is required"),
    billNo: z.string().min(1, "Bill No. is required"),
    billDate: z.string().min(1, "Bill date is required"),
    billAmount: z.coerce
      .number({ required_error: "Bill amount is required" })
      .min(0, "Must be non-negative"),
    paidAmount: z.coerce.number().min(0, "Must be non-negative").default(0),
    dueAmount: z.coerce.number().default(0),
    dueDate: z.string().min(1, "Due date is required"),
  paymentDate: z.string().nullable().optional(),
  paymentMode: z.enum(["CASH", "UPI", "CHEQUE", "RTGS", "NEFT", "NET_BANKING"]),
    chequeNo: z.string().nullable().optional(),
    chequeDate: z.string().nullable().optional(),
    utrNo: z.string().nullable().optional(),
    bankName: z.string().nullable().optional(),
    rtgsDate: z.string().nullable().optional(),
    neftDate: z.string().nullable().optional(),
    transactionNo: z.string().nullable().optional(),
    transactionDate: z.string().nullable().optional(),
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

    // For cheque payments require cheque details and bank name
    if (values.paymentMode === "CHEQUE") {
      if (!values.bankName || !values.bankName.trim()) {
        ctx.addIssue({
          path: ["bankName"],
          code: z.ZodIssueCode.custom,
          message: "Bank name is required for cheque payments",
        });
      }

      if (!values.chequeNo || !values.chequeNo.trim()) {
        ctx.addIssue({
          path: ["chequeNo"],
          code: z.ZodIssueCode.custom,
          message: "Cheque number is required for cheque payments",
        });
      }

      if (!values.chequeDate || !values.chequeDate.trim()) {
        ctx.addIssue({
          path: ["chequeDate"],
          code: z.ZodIssueCode.custom,
          message: "Cheque date is required for cheque payments",
        });
      }
    }
    // For NEFT payments require utr, bank name and neft date
    if (values.paymentMode === "NEFT") {
      if (!values.utrNo || !values.utrNo.trim()) {
        ctx.addIssue({ path: ["utrNo"], code: z.ZodIssueCode.custom, message: "UTR No. is required for NEFT payments" });
      }
      if (!values.bankName || !values.bankName.trim()) {
        ctx.addIssue({ path: ["bankName"], code: z.ZodIssueCode.custom, message: "Bank name is required for NEFT payments" });
      }
      if (!values.neftDate || !values.neftDate.trim()) {
        ctx.addIssue({ path: ["neftDate"], code: z.ZodIssueCode.custom, message: "NEFT date is required for NEFT payments" });
      }
    }

    // For RTGS payments require utr, bank name and rtgs date
    if (values.paymentMode === "RTGS") {
      if (!values.utrNo || !values.utrNo.trim()) {
        ctx.addIssue({ path: ["utrNo"], code: z.ZodIssueCode.custom, message: "UTR No. is required for RTGS payments" });
      }
      if (!values.bankName || !values.bankName.trim()) {
        ctx.addIssue({ path: ["bankName"], code: z.ZodIssueCode.custom, message: "Bank name is required for RTGS payments" });
      }
      if (!values.rtgsDate || !values.rtgsDate.trim()) {
        ctx.addIssue({ path: ["rtgsDate"], code: z.ZodIssueCode.custom, message: "RTGS date is required for RTGS payments" });
      }
    }

    // For Net Banking require transaction date, transaction number and bank name
    if (values.paymentMode === "NET_BANKING") {
      if (!values.transactionNo || !values.transactionNo.trim()) {
        ctx.addIssue({ path: ["transactionNo"], code: z.ZodIssueCode.custom, message: "Transaction number is required for Net Banking" });
      }
      if (!values.transactionDate || !values.transactionDate.trim()) {
        ctx.addIssue({ path: ["transactionDate"], code: z.ZodIssueCode.custom, message: "Transaction date is required for Net Banking" });
      }
      if (!values.bankName || !values.bankName.trim()) {
        ctx.addIssue({ path: ["bankName"], code: z.ZodIssueCode.custom, message: "Bank name is required for Net Banking" });
      }
    }
  });

  type FormValues = z.infer<typeof schema>;

  const qpSubContractorWorkOrderId = sp?.get("subContractorWorkOrderId");
  const defaultScwoId = qpSubContractorWorkOrderId ? parseInt(qpSubContractorWorkOrderId) : undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      subContractorWorkOrderId: initial?.subContractorWorkOrderId ?? defaultScwoId ?? undefined,
      billNo: initial?.billNo ?? "",
      billDate: initial?.billDate ?? "",
      billAmount: initial?.billAmount ?? 0,
      paidAmount: initial?.paidAmount ?? 0,
      dueAmount: initial?.dueAmount ?? 0,
      dueDate: initial?.dueDate ?? "",
      paymentDate: initial?.paymentDate ?? null,
      paymentMode: (initial?.paymentMode as any) ?? "CASH",
      chequeNo: initial?.chequeNo ?? null,
      chequeDate: initial?.chequeDate ?? null,
      utrNo: initial?.utrNo ?? null,
    bankName: initial?.bankName ?? null,
    rtgsDate: initial?.rtgsDate ?? null,
    neftDate: initial?.neftDate ?? null,
    transactionNo: initial?.transactionNo ?? null,
    transactionDate: initial?.transactionDate ?? null,
      deductionTax: initial?.deductionTax ?? 0,
      status: initial?.status ?? "UNPAID",
      remarks: undefined,
    },
  });

  const { control, handleSubmit, reset } = form;
  const isCreate = mode === "create";

  const currentScwoId = initial?.subContractorWorkOrderId ?? defaultScwoId;

  const { data: scwoDetail } = useSWR<SubContractorWorkOrderSummary>(
    currentScwoId ? `/api/sub-contractor-work-orders/${currentScwoId}` : null,
    apiGet
  );

  function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
    const base = new Date(y, (m || 1) - 1, d || 1);
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const billDateVal = form.watch("billDate");
  useEffect(() => {
    const terms = scwoDetail?.paymentTermsInDays;

    if (billDateVal && typeof terms === "number" && !Number.isNaN(terms)) {
      const due = addDays(billDateVal, terms);
      form.setValue("dueDate", due, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [billDateVal, scwoDetail?.paymentTermsInDays]);

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
          const pm = formData.paymentMode;
          const normalized = {
              chequeNo: pm === "CHEQUE" ? formData.chequeNo ?? null : null,
              chequeDate: pm === "CHEQUE" ? formData.chequeDate ?? null : null,
              bankName: ["CHEQUE", "RTGS", "NEFT", "NET_BANKING"].includes(pm) ? formData.bankName ?? null : null,
              utrNo: ["UPI", "NEFT", "RTGS"].includes(pm) ? formData.utrNo ?? null : null,
              rtgsDate: pm === "RTGS" ? formData.rtgsDate ?? null : null,
              neftDate: pm === "NEFT" ? formData.neftDate ?? null : null,
              transactionNo: pm === "NET_BANKING" ? formData.transactionNo ?? null : null,
              transactionDate: pm === "NET_BANKING" ? formData.transactionDate ?? null : null,
            };
        const computedDue =
          (formData.billAmount ?? 0) -
          (formData.paidAmount ?? 0) -
          (formData.deductionTax ?? 0);
        const payload: CreateSubContractorWorkOrderBillData = {
          subContractorWorkOrderId: formData.subContractorWorkOrderId,
          billNo: formData.billNo,
          billDate: formData.billDate,
          billAmount: formData.billAmount,
          paidAmount: formData.paidAmount,
          dueAmount: computedDue,
          dueDate: formData.dueDate,
          paymentDate: formData.paymentDate ?? null,
          paymentMode: formData.paymentMode,
          chequeNo: normalized.chequeNo,
          chequeDate: normalized.chequeDate,
          utrNo: normalized.utrNo,
          bankName: normalized.bankName,
          deductionTax: formData.deductionTax ?? 0,
          status: formData.status,
        };
        res = await apiPost("/api/sub-contractor-work-order-bills", payload);
        toast.success("Sub contractor work order bill created successfully");
        reset({
          subContractorWorkOrderId: initial?.subContractorWorkOrderId ?? defaultScwoId ?? undefined,
          billNo: "",
          billDate: "",
          billAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          dueDate: "",
          paymentDate: null,
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
          chequeNo: pm === "CHEQUE" ? formData.chequeNo ?? null : null,
          chequeDate: pm === "CHEQUE" ? formData.chequeDate ?? null : null,
          bankName: ["CHEQUE", "RTGS", "NEFT", "NET_BANKING"].includes(pm) ? formData.bankName ?? null : null,
          utrNo: ["UPI", "NEFT", "RTGS"].includes(pm) ? formData.utrNo ?? null : null,
          rtgsDate: pm === "RTGS" ? formData.rtgsDate ?? null : null,
          neftDate: pm === "NEFT" ? formData.neftDate ?? null : null,
          transactionNo: pm === "NET_BANKING" ? formData.transactionNo ?? null : null,
          transactionDate: pm === "NET_BANKING" ? formData.transactionDate ?? null : null,
        };
        const computedDue =
          (formData.billAmount ?? 0) -
          (formData.paidAmount ?? 0) -
          (formData.deductionTax ?? 0);
        const payload: UpdateSubContractorWorkOrderBillData = {
          subContractorWorkOrderId: formData.subContractorWorkOrderId,
          billNo: formData.billNo,
          billDate: formData.billDate,
          billAmount: formData.billAmount,
          paidAmount: formData.paidAmount,
          dueAmount: computedDue,
          dueDate: formData.dueDate,
          paymentDate: formData.paymentDate ?? null,
          paymentMode: formData.paymentMode,
          chequeNo: normalized.chequeNo,
          chequeDate: normalized.chequeDate,
          utrNo: normalized.utrNo,
          bankName: normalized.bankName,
          deductionTax: formData.deductionTax ?? 0,
          status: formData.status,
        };
        res = await apiPatch(`/api/sub-contractor-work-order-bills/${initial.id}`, payload);
        toast.success("Sub contractor work order bill updated successfully");
        onSuccess?.(res);
      }

      if (mutate) {
        await mutate();
      }

      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save sub contractor work order bill");
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
            {isCreate ? "Create Sub Contractor Work Order Bill" : "Edit Sub Contractor Work Order Bill"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new bill for a sub contractor work order."
              : "Update sub contractor work order bill."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            {scwoDetail && (
              <div className="mb-4 rounded-md border p-3 text-sm grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">WO No.</div>
                  <div className="font-medium">{scwoDetail.workOrderNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vendor</div>
                  <div className="font-medium">{scwoDetail.vendor?.vendorName || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Site</div>
                  <div className="font-medium">{scwoDetail.site?.site || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">WO Date</div>
                  <div className="font-medium">{scwoDetail.workOrderDate?.slice(0, 10)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment Terms</div>
                  <div className="font-medium">{scwoDetail.paymentTermsInDays ?? 0} days</div>
                </div>
              </div>
            )}
            <FormSection legend="Bill Information">
              <FormRow cols={3} from="md">
                <TextInput control={control} name="billNo" label="Bill No." required />
                <TextInput control={control} name="billDate" label="Bill Date" type="date" required />
                <TextInput control={control} name="billAmount" label="Bill Amount" required />
              </FormRow>
              <FormRow cols={3} from="md">
                <TextInput control={control} name="dueDate" label="Due Date" type="date" disabled required />
                <TextInput control={control} name="paymentDate" label="Payment Date" type="date" />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Mode</label>
                  <AppSelect
                    value={paymentMode}
                    onValueChange={(v) => {
                      // Clear or preserve fields depending on selection
                      if (v === "CASH") {
                        form.setValue("bankName", null, { shouldValidate: true });
                        form.setValue("chequeNo", null, { shouldValidate: true });
                        form.setValue("chequeDate", null, { shouldValidate: true });
                        form.setValue("utrNo", null, { shouldValidate: true });
                        form.setValue("rtgsDate", null, { shouldValidate: true });
                        form.setValue("neftDate", null, { shouldValidate: true });
                        form.setValue("transactionNo", null, { shouldValidate: true });
                        form.setValue("transactionDate", null, { shouldValidate: true });
                      } else if (v === "UPI") {
                        // UPI requires UTR only
                        form.setValue("bankName", null, { shouldValidate: true });
                        form.setValue("chequeNo", null, { shouldValidate: true });
                        form.setValue("chequeDate", null, { shouldValidate: true });
                        form.setValue("rtgsDate", null, { shouldValidate: true });
                        form.setValue("neftDate", null, { shouldValidate: true });
                        form.setValue("transactionNo", null, { shouldValidate: true });
                        form.setValue("transactionDate", null, { shouldValidate: true });
                      } else if (v === "CHEQUE") {
                        // keep bank/cheque fields; clear utr and other transfer fields
                        form.setValue("utrNo", null, { shouldValidate: true });
                        form.setValue("rtgsDate", null, { shouldValidate: true });
                        form.setValue("neftDate", null, { shouldValidate: true });
                        form.setValue("transactionNo", null, { shouldValidate: true });
                        form.setValue("transactionDate", null, { shouldValidate: true });
                      } else if (v === "RTGS") {
                        // RTGS needs utr, bankName and rtgsDate
                        form.setValue("chequeNo", null, { shouldValidate: true });
                        form.setValue("chequeDate", null, { shouldValidate: true });
                        form.setValue("neftDate", null, { shouldValidate: true });
                        form.setValue("transactionNo", null, { shouldValidate: true });
                        form.setValue("transactionDate", null, { shouldValidate: true });
                      } else if (v === "NEFT") {
                        // NEFT needs utr, bankName and neftDate
                        form.setValue("chequeNo", null, { shouldValidate: true });
                        form.setValue("chequeDate", null, { shouldValidate: true });
                        form.setValue("rtgsDate", null, { shouldValidate: true });
                        form.setValue("transactionNo", null, { shouldValidate: true });
                        form.setValue("transactionDate", null, { shouldValidate: true });
                      } else if (v === "NET_BANKING") {
                        // Net banking needs transaction fields and bankName
                        form.setValue("chequeNo", null, { shouldValidate: true });
                        form.setValue("chequeDate", null, { shouldValidate: true });
                        form.setValue("rtgsDate", null, { shouldValidate: true });
                        form.setValue("neftDate", null, { shouldValidate: true });
                      }
                      form.setValue("paymentMode", v as any, { shouldValidate: true });
                    }}
                    placeholder="Select Payment Mode"
                  >
                    <AppSelect.Item value="CASH">Cash</AppSelect.Item>
                    <AppSelect.Item value="UPI">UPI</AppSelect.Item>
                    <AppSelect.Item value="CHEQUE">Cheque</AppSelect.Item>
                    <AppSelect.Item value="RTGS">RTGS</AppSelect.Item>
                    <AppSelect.Item value="NEFT">NEFT</AppSelect.Item>
                    <AppSelect.Item value="NET_BANKING">Net Banking</AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>

              {paymentMode === "CHEQUE" && (
                <FormRow cols={3} from="md">
                  <TextInput control={control} name="bankName" label="Bank Name" />
                  <TextInput control={control} name="chequeNo" label="Cheque No." />
                  <TextInput control={control} name="chequeDate" label="Cheque Date" type="date" />
                </FormRow>
              )}

              {paymentMode === "UPI" && (
                <FormRow cols={1}>
                  <TextInput control={control} name="utrNo" label="UTR No." />
                </FormRow>
              )}

              {paymentMode === "CHEQUE" && (
                <FormRow cols={3} from="md">
                  <TextInput control={control} name="bankName" label="Bank Name" />
                  <TextInput control={control} name="chequeNo" label="Cheque No." />
                  <TextInput control={control} name="chequeDate" label="Cheque Date" type="date" />
                </FormRow>
              )}

              {paymentMode === "RTGS" && (
                <FormRow cols={3} from="md">
                  <TextInput control={control} name="utrNo" label="UTR No." />
                  <TextInput control={control} name="bankName" label="Bank Name" />
                  <TextInput control={control} name="rtgsDate" label="RTGS Date" type="date" />
                </FormRow>
              )}

              {paymentMode === "NEFT" && (
                <FormRow cols={3} from="md">
                  <TextInput control={control} name="utrNo" label="UTR No." />
                  <TextInput control={control} name="bankName" label="Bank Name" />
                  <TextInput control={control} name="neftDate" label="NEFT Date" type="date" />
                </FormRow>
              )}

              {paymentMode === "NET_BANKING" && (
                <FormRow cols={3} from="md">
                  <TextInput control={control} name="transactionDate" label="Transaction Date" type="date" />
                  <TextInput control={control} name="transactionNo" label="Transaction No." />
                  <TextInput control={control} name="bankName" label="Bank Name" />
                </FormRow>
              )}

              <FormRow cols={3} from="md">
                <TextInput control={control} name="deductionTax" label="Deduction / Tax" />
                <TextInput control={control} name="paidAmount" label="Paid Amount" />
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
                    <AppSelect.Item value="PARTIALLY_PAID">Partially Paid</AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton type="button" variant="secondary" onClick={backWithScrollRestore} disabled={submitting} iconName="X">
              Cancel
            </AppButton>
            <AppButton type="submit" iconName={isCreate ? "Plus" : "Save"} isLoading={submitting} disabled={submitting || !form.formState.isValid}>
              {isCreate ? "Create Bill" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default SubContractorWorkOrderBillForm;
