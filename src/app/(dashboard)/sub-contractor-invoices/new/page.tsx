"use client";

import { SubContractorInvoiceForm } from "../sub-contractor-invoice-form";
import { useSearchParams } from "next/navigation";

export default function NewSubContractorInvoicePage() {
  const searchParams = useSearchParams();
  const siteIdParam = searchParams?.get("siteId");
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
  const initial = typeof siteId === "number" && !Number.isNaN(siteId) ? { siteId } : undefined;

  return (
    <SubContractorInvoiceForm
      mode="create"
      initial={initial}
    />
  );
}
