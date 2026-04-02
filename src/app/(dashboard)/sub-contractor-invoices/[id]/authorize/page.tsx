"use client";

import { use } from "react";
import { SubContractorInvoiceForm } from "../../sub-contractor-invoice-form";

interface AuthorizeSubContractorInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function AuthorizeSubContractorInvoicePage({ params }: AuthorizeSubContractorInvoicePageProps) {
  const { id } = use(params);
  return (
    <SubContractorInvoiceForm
      mode="authorize"
      id={parseInt(id)}
    />
  );
}
