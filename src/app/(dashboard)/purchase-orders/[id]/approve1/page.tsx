"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppCard } from "@/components/common/app-card";
import type { PurchaseOrder } from "@/types/purchase-orders";
import { PurchaseOrderForm } from "../../purchase-order-form";

export default function PurchaseOrderApprove1Page() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? parseInt(params.id as string, 10) : null;

  const {
    data: purchaseOrder,
    isLoading,
    error,
    mutate,
  } = useSWR<PurchaseOrder>(id ? `/api/purchase-orders/${id}` : null, apiGet);

  const initialData = useMemo(() => {
    if (!purchaseOrder || !id) {
      return null;
    }

    return {
      id: purchaseOrder.id,
      purchaseOrderNo: purchaseOrder.purchaseOrderNo,
      purchaseOrderDate: purchaseOrder.purchaseOrderDate,
      deliveryDate: purchaseOrder.deliveryDate,
      siteId: purchaseOrder.site?.id,
      boqId: (purchaseOrder as any).boqId ?? null,
      vendorId: purchaseOrder.vendor?.id,
      billingAddressId: purchaseOrder.billingAddress?.id,
      siteDeliveryAddressId: purchaseOrder.siteDeliveryAddress?.id,
      paymentTermId: purchaseOrder.paymentTerm?.id,
      quotationNo: purchaseOrder.quotationNo ?? undefined,
      quotationDate: purchaseOrder.quotationDate ?? undefined,
      transport: purchaseOrder.transport,
      note: purchaseOrder.note,
      terms: purchaseOrder.terms,
      poStatus: purchaseOrder.poStatus === "HOLD" ? ("HOLD" as const) : null,
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
          ? (purchaseOrder.pfStatus as
              | "EXCLUSIVE"
              | "INCLUSIVE"
              | "NOT_APPLICABLE")
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
      purchaseOrderItems: purchaseOrder.purchaseOrderDetails?.map(
        (detail: any) => ({
          id: detail.id,
          itemId: detail.itemId,
          item: detail.item,
          remark: detail.remark,
          qty: detail.qty,
          orderedQty: detail.orderedQty,
          approved1Qty: detail.approved1Qty,
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
        })
      ),
    };
  }, [id, purchaseOrder]);

  if (error) {
    toast.error("Failed to load purchase order");
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AppCard>
          <AppCard.Content>
            <p className="text-center text-muted-foreground">
              Failed to load purchase order. Please try again.
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
          <p className="mt-4 text-muted-foreground">
            Loading purchase order...
          </p>
        </div>
      </div>
    );
  }

  return (
    <PurchaseOrderForm
      mode="approval1"
      initial={initialData}
      mutate={mutate}
      onSuccess={() => router.push("/purchase-orders")}
      redirectOnSuccess="/purchase-orders"
    />
  );
}
