"use client";

import { use } from "react";
import { SubContractorInvoiceForm } from "../../sub-contractor-invoice-form";

interface ViewSubContractorInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function ViewSubContractorInvoicePage({ params }: ViewSubContractorInvoicePageProps) {
  const { id } = use(params);
  return (
    <SubContractorInvoiceForm
      mode="view"
      id={parseInt(id)}
    />
  );
}
