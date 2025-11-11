"use client";

import { PurchaseOrderForm } from "../purchase-order-form";
import { useSearchParams } from "next/navigation";

export default function NewPurchaseOrderPage() {
  const searchParams = useSearchParams();
  const indentId = searchParams.get("indentId");

  return <PurchaseOrderForm mode="create" indentId={indentId ? parseInt(indentId) : undefined} />;
}