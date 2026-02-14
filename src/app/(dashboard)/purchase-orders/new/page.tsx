"use client";

import { PurchaseOrderForm } from "../purchase-order-form";
import { useSearchParams } from "next/navigation";

export default function NewPurchaseOrderPage() {
  const searchParams = useSearchParams();
  const indentIdParam = searchParams?.get("indentId");
  const indentId = indentIdParam ? parseInt(indentIdParam, 10) : undefined;
  const indentIdsParam = searchParams?.get("indentIds") || "";
  const indentIds = indentIdsParam
    ? Array.from(
        new Set(
          indentIdsParam
            .split(",")
            .map((x) => parseInt(String(x || "").trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
    : [];
  const siteIdParam = searchParams?.get("siteId");
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
  const rParam = searchParams?.get("r") ?? "";
  const initial = typeof siteId === "number" && !Number.isNaN(siteId) ? { siteId } : undefined;

  return (
    <PurchaseOrderForm
      key={`create-po-${indentIds.length > 0 ? indentIds.join("-") : indentId ?? "none"}-${siteId ?? "nosite"}-${rParam}`}
      mode="create"
      indentId={indentId}
      indentIds={indentIds.length > 0 ? indentIds : undefined}
      refreshKey={rParam}
      initial={initial as any}
    />
  );
}


