"use client";

import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppCard } from "@/components/common/app-card";
import { WorkOrderForm } from "../../work-order-form";

export default function EditWorkOrderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const idRaw = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const id = idRaw ? parseInt(idRaw, 10) : null;

  // Build redirect URL with preserved query parameters
  const search = searchParams ? searchParams.toString() : "";
  const redirectUrl = search ? `/work-orders?${search}` : "/work-orders";

  const { data: workOrder, error, isLoading, mutate } = useSWR<any>(
    id ? `/api/work-orders/${id}` : null,
    apiGet
  );

  const initialData = useMemo(() => {
    if (!workOrder || !id) return null;

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
        remark: detail.remark ?? undefined,
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

  useEffect(() => {
    if (error) {
      toast.error((error as Error).message || "Failed to load work order");
    }
  }, [error]);

  if (isLoading || !id) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <p>Loading work order...</p>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!workOrder || !initialData) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <p className="text-muted-foreground">Work order not found</p>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <WorkOrderForm
      mode="edit"
      initial={initialData as any}
      redirectOnSuccess={redirectUrl}
      mutate={mutate as any}
    />
  );
}
