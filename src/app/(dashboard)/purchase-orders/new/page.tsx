"use client";

import { PurchaseOrderForm } from "../purchase-order-form";
import { useSearchParams } from "next/navigation";

export default function NewPurchaseOrderPage() {
  const searchParams = useSearchParams();
  const indentIdParam = searchParams?.get("indentId");
  const indentId = indentIdParam ? parseInt(indentIdParam, 10) : undefined;

  return <PurchaseOrderForm mode="create" indentId={indentId} />;
}