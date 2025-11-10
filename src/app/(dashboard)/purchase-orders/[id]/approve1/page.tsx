"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { PurchaseOrderForm } from "../../purchase-order-form";

export default function PurchaseOrderApprove1Page() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? parseInt(params.id as string) : null;

  const { data: purchaseOrder, isLoading, error } = useSWR(
    id ? `/api/purchase-orders/${id}` : null,
    apiGet
  );

  useEffect(() => {
    if (error) {
      router.push("/purchase-orders");
    }
  }, [error, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (!purchaseOrder || !id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AppCard>
          <AppCard.Content>
            <p className="text-center text-muted-foreground">
              Purchase order not found
            </p>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  return (
    <PurchaseOrderForm
      mode="approval1"
      initial={{
        id: purchaseOrder.id,
        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
        purchaseOrderDate: purchaseOrder.purchaseOrderDate,
        deliveryDate: purchaseOrder.deliveryDate,
        siteId: purchaseOrder.site?.id,
        vendorId: purchaseOrder.vendor?.id,
        billingAddressId: purchaseOrder.billingAddress?.id,
        siteDeliveryAddressId: purchaseOrder.siteDeliveryAddress?.id,
        paymentTermId: purchaseOrder.paymentTerm?.id,
        quotationNo: purchaseOrder.quotationNo,
        quotationDate: purchaseOrder.quotationDate,
        transport: purchaseOrder.transport,
        note: purchaseOrder.note,
        terms: purchaseOrder.terms,
        poStatus: purchaseOrder.poStatus,
        paymentTermsInDays: purchaseOrder.paymentTermsInDays,
        deliverySchedule: purchaseOrder.deliverySchedule,
        transitInsuranceStatus: purchaseOrder.transitInsuranceStatus,
        transitInsuranceAmount: purchaseOrder.transitInsuranceAmount,
        pfStatus: purchaseOrder.pfStatus,
        pfCharges: purchaseOrder.pfCharges,
        gstReverseStatus: purchaseOrder.gstReverseStatus,
        gstReverseAmount: purchaseOrder.gstReverseAmount,
        purchaseOrderItems: purchaseOrder.purchaseOrderDetails?.map((detail: any) => ({
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
        })),
      }}
      onSuccess={() => router.push("/purchase-orders")}
      redirectOnSuccess="/purchase-orders"
    />
  );
}
