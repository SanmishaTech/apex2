"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  WorkOrderBillForm,
  WorkOrderBillFormInitialData,
} from "../../work-order-bill-form";
import { WorkOrderBill } from "@/types/work-order-bills";

export default function EditWorkOrderBillPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const {
    data: bill,
    error,
    isLoading,
    mutate,
  } = useSWR<WorkOrderBill>(
    Number.isFinite(id) ? `/api/work-order-bills/${id}` : null,
    apiGet
  );

  const initialData = useMemo<WorkOrderBillFormInitialData | null>(() => {
    if (!bill) return null;
    return {
      id: bill.id,
      workOrderId: bill.workOrderId,
      billNo: bill.billNo,
      billDate: bill.billDate?.slice(0, 10),
      billAmount: bill.billAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      dueDate: bill.dueDate?.slice(0, 10),
      paymentDate: bill.paymentDate?.slice(0, 10),
      paymentMode: bill.paymentMode,
      chequeNo: bill.chequeNo ?? null,
      chequeDate: bill.chequeDate ? bill.chequeDate.slice(0, 10) : null,
      utrNo: bill.utrNo ?? null,
      bankName: bill.bankName ?? null,
      deductionTax: bill.deductionTax,
      status: bill.status,
    };
  }, [bill]);

  if (error) {
    toast.error((error as Error).message || "Failed to load work order bill");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load work order bill. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <WorkOrderBillForm
        mode="edit"
        initial={initialData}
        redirectOnSuccess="/work-order-bills"
        mutate={mutate}
      />
    </div>
  );
}
