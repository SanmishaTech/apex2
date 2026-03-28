"use client";

import { SubContractorWorkOrderForm } from "../sub-contractor-work-order-form";
import { useSearchParams } from "next/navigation";

export default function NewSubContractorWorkOrderPage() {
  const searchParams = useSearchParams();
  const siteIdParam = searchParams?.get("siteId");
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
  const initial = typeof siteId === "number" && !Number.isNaN(siteId) ? { siteId } : undefined;

  return (
    <SubContractorWorkOrderForm
      mode="create"
      initial={initial}
    />
  );
}
