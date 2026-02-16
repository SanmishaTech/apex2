"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppCard } from "@/components/common/app-card";
import { PurchaseOrderForm } from "../../purchase-order-form";

import type { PurchaseOrder } from "@/types/purchase-orders";

export default function EditPurchaseOrderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const idRaw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = idRaw ? parseInt(idRaw, 10) : null;

  // Build redirect URL with preserved query parameters
  const search = searchParams ? searchParams.toString() : "";
  const redirectUrl = search ? `/purchase-orders?${search}` : "/purchase-orders";

  const { data: purchaseOrder, error, isLoading, mutate } = useSWR<PurchaseOrder>(
    id ? `/api/purchase-orders/${id}` : null,
    apiGet
  );

  const initialData = useMemo(() => {
    if (!purchaseOrder || !id) return null;

    return {
      id: purchaseOrder.id,
      purchaseOrderNo: purchaseOrder.purchaseOrderNo,
      purchaseOrderDate: purchaseOrder.purchaseOrderDate,
      deliveryDate: purchaseOrder.deliveryDate,
      siteId: purchaseOrder.site?.id,
      purchaseOrderIndent: (purchaseOrder as any).purchaseOrderIndent,
      vendorId: purchaseOrder.vendor?.id,
      billingAddressId: purchaseOrder.billingAddress?.id,
      siteDeliveryAddressId: purchaseOrder.siteDeliveryAddress?.id,
      paymentTermIds:
        (purchaseOrder as any)?.poPaymentTerms?.length > 0
          ? ((purchaseOrder as any).poPaymentTerms as any[])
              .map((pt) => Number(pt.paymentTermId))
              .filter((n) => Number.isFinite(n) && n > 0)
          : purchaseOrder.paymentTerm?.id
            ? [Number(purchaseOrder.paymentTerm.id)]
            : [],
      quotationNo: purchaseOrder.quotationNo ?? undefined,
      quotationDate: purchaseOrder.quotationDate ?? undefined,
      transport: purchaseOrder.transport,
      note: purchaseOrder.note,
      poStatus: (purchaseOrder.poStatus as any) ?? null,
      paymentTermsInDays: purchaseOrder.paymentTermsInDays,
      deliverySchedule: purchaseOrder.deliverySchedule,
      transitInsuranceStatus:
        purchaseOrder.transitInsuranceStatus === "EXCLUSIVE" ||
        purchaseOrder.transitInsuranceStatus === "INCLUSIVE" ||
        purchaseOrder.transitInsuranceStatus === "NOT_APPLICABLE"
          ? (purchaseOrder.transitInsuranceStatus as
              | "EXCLUSIVE"
              | "INCLUSIVE"
              | "NOT_APPLICABLE")
          : null,
      transitInsuranceAmount:
        purchaseOrder.transitInsuranceAmount == null
          ? null
          : typeof purchaseOrder.transitInsuranceAmount === "string"
            ? purchaseOrder.transitInsuranceAmount
            : String(purchaseOrder.transitInsuranceAmount),
      pfStatus:
        purchaseOrder.pfStatus === "EXCLUSIVE" ||
        purchaseOrder.pfStatus === "INCLUSIVE" ||
        purchaseOrder.pfStatus === "NOT_APPLICABLE"
          ? (purchaseOrder.pfStatus as "EXCLUSIVE" | "INCLUSIVE" | "NOT_APPLICABLE")
          : null,
      pfCharges:
        purchaseOrder.pfCharges == null
          ? null
          : typeof purchaseOrder.pfCharges === "string"
            ? purchaseOrder.pfCharges
            : String(purchaseOrder.pfCharges),
      gstReverseStatus:
        purchaseOrder.gstReverseStatus === "EXCLUSIVE" ||
        purchaseOrder.gstReverseStatus === "INCLUSIVE" ||
        purchaseOrder.gstReverseStatus === "NOT_APPLICABLE"
          ? (purchaseOrder.gstReverseStatus as
              | "EXCLUSIVE"
              | "INCLUSIVE"
              | "NOT_APPLICABLE")
          : null,
      gstReverseAmount:
        purchaseOrder.gstReverseAmount == null
          ? null
          : typeof purchaseOrder.gstReverseAmount === "string"
            ? purchaseOrder.gstReverseAmount
            : String(purchaseOrder.gstReverseAmount),
      purchaseOrderItems: purchaseOrder.purchaseOrderDetails?.map((detail: any) => ({
        id: detail.id,
        itemId: detail.itemId,
        item: detail.item,
        remark: detail.remark,
        qty: detail.qty,
        orderedQty: detail.orderedQty,
        approved1Qty: detail.approved1Qty,
        approved2Qty: detail.approved2Qty,
        rate: detail.rate,
        discountPercent: detail.discountPercent,
        disAmt: detail.disAmt,
        cgstPercent: detail.cgstPercent,
        cgstAmt: detail.cgstAmt,
        sgstPercent: detail.sgstPercent,
        sgstAmt: detail.sgstAmt,
        igstPercent: detail.igstPercent,
        igstAmt: detail.igstAmt,
        amount: detail.amount,
        indentItemId: detail.indentItemId,
        indentItemPOs: detail.indentItemPOs,
      })),
    };
  }, [id, purchaseOrder]);

  useEffect(() => {
    if (error) {
      toast.error((error as Error).message || "Failed to load purchase order");
    }
  }, [error]);

  if (isLoading || !id) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <p>Loading purchase order...</p>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!purchaseOrder || !initialData) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <p className="text-muted-foreground">Purchase order not found</p>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <PurchaseOrderForm
      mode="edit"
      initial={initialData as any}
      redirectOnSuccess={redirectUrl}
      mutate={mutate as any}
    />
  );
}
