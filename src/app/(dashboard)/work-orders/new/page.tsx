"use client";

import { WorkOrderForm } from "../work-order-form";
import { useProtectPage } from "@/hooks/use-protect-page";

export default function NewWorkOrderPage() {
  useProtectPage();

  return <WorkOrderForm mode="create" />;
}


