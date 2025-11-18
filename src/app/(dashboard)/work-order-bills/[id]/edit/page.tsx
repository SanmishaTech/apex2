"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { WorkOrderBillForm } from "../../work-order-bill-form";
import { WorkOrderBill } from "@/types/work-order-bills";

export default function EditWorkOrderBillPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const { data } = useSWR<{ data: WorkOrderBill }>(
    Number.isFinite(id) ? `/api/work-order-bills/${id}` : null,
    apiGet
  );

  const bill = data?.data;

  return (
    <div className="max-w-5xl mx-auto">
      {bill && (
        <WorkOrderBillForm
          mode="edit"
          initial={{
            id: bill.id,
            workOrderId: bill.workOrderId,
            billNo: bill.billNo,
            billDate: bill.billDate,
            billAmount: bill.billAmount,
            paidAmount: bill.paidAmount,
            dueAmount: bill.dueAmount,
            dueDate: bill.dueDate,
            paymentDate: bill.paymentDate,
            paymentMode: bill.paymentMode,
            chequeNo: bill.chequeNo ?? null,
            chequeDate: bill.chequeDate ?? null,
            utrNo: bill.utrNo ?? null,
            bankName: bill.bankName ?? null,
            deductionTax: bill.deductionTax,
            status: bill.status,
          }}
          redirectOnSuccess="/work-order-bills"
        />
      )}
    </div>
  );
}
