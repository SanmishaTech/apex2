"use client";

import { useParams } from "next/navigation";
import { SalesInvoiceForm } from "../../sales-invoice-form";

export default function EditSalesInvoicePage() {
  const params = useParams();
  const id = Number(params?.id);

  if (Number.isNaN(id)) {
    return <div className="p-6 text-red-600">Invalid sales invoice ID.</div>;
  }

  return <SalesInvoiceForm mode="edit" id={id} />;
}
