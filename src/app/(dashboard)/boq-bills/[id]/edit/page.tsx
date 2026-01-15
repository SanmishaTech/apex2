"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { BoqBillForm, BoqBillFormInitialData } from "../../boq-bill-form";
import { BoqBill } from "@/types/boq-bills";

export default function EditBoqBillPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const { data, error, isLoading, mutate } = useSWR<BoqBill>(
    Number.isFinite(id) ? `/api/boq-bills/${id}` : null,
    apiGet
  );

  const initial = useMemo<BoqBillFormInitialData | null>(() => {
    if (!data) return null;
    return {
      id: data.id,
      boqId: data.boqId,
      billNumber: data.billNumber,
      billName: data.billName,
      billDate: data.billDate?.slice(0, 10),
      remarks: data.remarks ?? null,
      details: (data.boqBillDetails || []).map((d) => ({
        id: d.id,
        boqItemId: d.boqItemId,
        qty: Number(d.qty || 0),
      })),
    };
  }, [data]);

  if (error) {
    toast.error((error as Error).message || "Failed to load BOQ bill");
    return <div className="p-6">Failed to load</div>;
  }

  if (isLoading || !initial) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <BoqBillForm
        mode="edit"
        initial={initial}
        redirectOnSuccess="/boq-bills"
        mutate={mutate}
      />
    </div>
  );
}
