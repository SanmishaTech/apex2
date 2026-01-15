"use client";

import { BoqBillForm } from "../boq-bill-form";

export default function NewBoqBillPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <BoqBillForm mode="create" redirectOnSuccess="/boq-bills" />
    </div>
  );
}
