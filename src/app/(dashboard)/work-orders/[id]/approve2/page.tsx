"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppCard } from "@/components/common/app-card";
import { WorkOrderForm } from "../../work-order-form";
import { useProtectPage } from "@/hooks/use-protect-page";

export default function WorkOrderApprove2Page() {
  useProtectPage();

  const params = useParams();
  const router = useRouter();
  const id = params?.id ? parseInt(params.id as string, 10) : null;

  const {
    data: workOrder,
    isLoading,
    error,
    mutate,
  } = useSWR<any>(id ? `/api/work-orders/${id}` : null, apiGet);

  const initialData = useMemo(() => {
    if (!workOrder || !id) {
      return null;
    }

    return {
      type: workOrder.type as any,
      id: workOrder.id,
      workOrderNo: workOrder.workOrderNo,
      workOrderDate: workOrder.workOrderDate,
      deliveryDate: workOrder.deliveryDate,
      purchaseOrderId: workOrder.purchaseOrderId,
      boqId: workOrder.boqId,
      siteId: workOrder.site?.id,
      vendorId: workOrder.vendor?.id,
      billingAddressId: workOrder.billingAddress?.id,
      siteDeliveryAddressId: workOrder.siteDeliveryAddress?.id,
      paymentTermIds: Array.isArray(workOrder.WOPaymentTerms)
        ? workOrder.WOPaymentTerms.map((t: any) => t.paymentTermId)
        : [],
      quotationNo: workOrder.quotationNo ?? undefined,
      quotationDate: workOrder.quotationDate ?? undefined,
      transport: workOrder.transport,
      note: workOrder.note,
      terms: workOrder.terms,
      woStatus: workOrder.woStatus === "HOLD" ? ("HOLD" as const) : null,
      paymentTermsInDays: workOrder.paymentTermsInDays,
      deliverySchedule: workOrder.deliverySchedule,
      workOrderItems: workOrder.workOrderDetails?.map((detail: any) => ({
        id: detail.id,
        serialNo: detail.serialNo,
        Item: detail.Item,
        unitId: detail.unitId,
        unit: detail.unit,
        sac_code: detail.sac_code,
        remark: detail.remark,
        qty: detail.qty,
        orderedQty: detail.orderedQty,
        approved1Qty: detail.approved1Qty,
        approved2Qty: detail.approved2Qty,
        rate: detail.rate,
        cgstPercent: detail.cgstPercent,
        cgstAmt: detail.cgstAmt,
        sgstPercent: detail.sgstPercent,
        sgstAmt: detail.sgstAmt,
        igstPercent: detail.igstPercent,
        igstAmt: detail.igstAmt,
        amount: detail.amount,
      })),
    };
  }, [id, workOrder]);

  if (error) {
    toast.error("Failed to load work order");
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AppCard>
          <AppCard.Content>
            <p className="text-center text-muted-foreground">
              Failed to load work order. Please try again.
            </p>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading work order...</p>
        </div>
      </div>
    );
  }

  return (
    <WorkOrderForm
      mode="approval2"
      initial={initialData}
      mutate={mutate}
      onSuccess={() => router.push("/work-orders")}
      redirectOnSuccess="/work-orders"
    />
  );
}
