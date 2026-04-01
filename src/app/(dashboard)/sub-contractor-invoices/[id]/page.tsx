"use client";

import { use } from "react";
import { SubContractorInvoiceForm } from "../sub-contractor-invoice-form";

interface EditSubContractorInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function EditSubContractorInvoicePage({ params }: EditSubContractorInvoicePageProps) {
  const { id } = use(params);
  return (
    <SubContractorInvoiceForm
      mode="edit"
      id={parseInt(id)}
    />
  );
}
