"use client";

import { PurchaseOrderForm } from "../purchase-order-form";
import { useSearchParams } from "next/navigation";

export default function NewPurchaseOrderPage() {
  const searchParams = useSearchParams();
  const indentIdParam = searchParams?.get("indentId");
  const indentId = indentIdParam ? parseInt(indentIdParam, 10) : undefined;
  const siteIdParam = searchParams?.get("siteId");
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
  const rParam = searchParams?.get("r") ?? "";
  const initial = typeof siteId === "number" && !Number.isNaN(siteId) ? { siteId } : undefined;

  return (
    <PurchaseOrderForm
      key={`create-po-${indentId ?? "none"}-${siteId ?? "nosite"}-${rParam}`}
      mode="create"
      indentId={indentId}
      initial={initial as any}
    />
  );
}


