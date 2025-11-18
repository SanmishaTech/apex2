"use client";

import { WorkOrderForm } from "../work-order-form";
import { useSearchParams } from "next/navigation";

export default function NewWorkOrderPage() {
  const searchParams = useSearchParams();
  const indentIdParam = searchParams?.get("indentId");
  const indentId = indentIdParam ? parseInt(indentIdParam, 10) : undefined;

  return <WorkOrderForm mode="create" indentId={indentId} />;
}


