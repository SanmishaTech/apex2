"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  SubContractorWorkOrderBillForm,
  SubContractorWorkOrderBillFormInitialData,
} from "../../work-order-bill-form";
import { SubContractorWorkOrderBill } from "@/types/sub-contractor-work-order-bills";
import { useProtectPage } from "@/hooks/use-protect-page";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

export default function EditSubContractorWorkOrderBillPage() {
  useProtectPage();
  const { can } = usePermissions();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  if (!can(PERMISSIONS.EDIT_SUB_CONTRACTOR_WORK_ORDER_BILLS)) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">You don't have permission to edit sub contractor work order bills.</div>
      </div>
    );
  }

  const {
    data: bill,
    error,
    isLoading,
    mutate,
  } = useSWR<SubContractorWorkOrderBill>(Number.isFinite(id) ? `/api/sub-contractor-work-order-bills/${id}` : null, apiGet);

  const initialData = useMemo<SubContractorWorkOrderBillFormInitialData | null>(() => {
    if (!bill) return null;
    return {
      id: bill.id,
      subContractorWorkOrderId: bill.subContractorWorkOrderId,
      billNo: bill.billNo,
      billDate: bill.billDate?.slice(0, 10),
      billAmount: bill.billAmount,
      paidAmount: bill.paidAmount ?? 0,
      dueAmount: bill.dueAmount,
      dueDate: bill.dueDate?.slice(0, 10),
      paymentDate: bill.paymentDate ? bill.paymentDate.slice(0, 10) : null,
      paymentMode: bill.paymentMode,
      chequeNo: bill.chequeNo ?? null,
      chequeDate: bill.chequeDate ? bill.chequeDate.slice(0, 10) : null,
      utrNo: bill.utrNo ?? null,
      bankName: bill.bankName ?? null,
      deductionTax: bill.deductionTax ?? 0,
      status: bill.status,
    };
  }, [bill]);

  if (error) {
    toast.error((error as Error).message || "Failed to load sub contractor work order bill");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Failed to load sub contractor work order bill. Please try again.</div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <SubContractorWorkOrderBillForm mode="edit" initial={initialData} redirectOnSuccess="/sub-contractor-work-order-bills" mutate={mutate} />
    </div>
  );
}
