"use client";

import { use } from "react";
import { SubContractorWorkOrderForm } from "../../sub-contractor-work-order-form";
import { apiGet } from "@/lib/api-client";
import useSWR from "swr";
import { SubContractorWorkOrder } from "@/types/sub-contractor-work-orders";

export default function Approve1SubContractorWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useSWR<{ data: SubContractorWorkOrder }>(`/api/sub-contractor-work-orders/${id}`, apiGet);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data?.data) return <div className="p-8 text-center">Work order not found</div>;

  return (
    <SubContractorWorkOrderForm
      mode="approval1"
      initial={data.data}
    />
  );
}
