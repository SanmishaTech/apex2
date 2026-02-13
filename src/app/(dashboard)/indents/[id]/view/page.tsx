"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDateDMY, formatDateTime } from "@/lib/locales";

import type { Indent } from "@/types/indents";

function prettyStatus(s?: string) {
  switch (s) {
    case "APPROVED_LEVEL_1":
      return "Approved 1";
    case "APPROVED_LEVEL_2":
      return "Approved 2";
    case "COMPLETED":
      return "Completed";
    case "SUSPENDED":
      return "Suspended";
    default:
      return "Draft";
  }
}

function StatusBadge({
  status,
  suspended,
}: {
  status?: string;
  suspended?: boolean;
}) {
  const label = suspended ? "Suspended" : prettyStatus(status);
  const cls = suspended
    ? "bg-rose-600"
    : status === "APPROVED_LEVEL_1"
      ? "bg-amber-600"
      : status === "APPROVED_LEVEL_2"
        ? "bg-sky-600"
        : status === "COMPLETED"
          ? "bg-emerald-600"
          : "bg-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const value = (priority || "LOW").toUpperCase();
  const label =
    value === "HIGH" ? "High" : value === "MEDIUM" ? "Medium" : "Low";
  const cls =
    value === "HIGH"
      ? "bg-rose-600"
      : value === "MEDIUM"
        ? "bg-amber-600"
        : "bg-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
    >
      {label}
    </span>
  );
}

export default function IndentViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useSWR<Indent>(
    params?.id ? `/api/indents/${params.id}` : null,
    apiGet
  );

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Indent not found</div>
      </div>
    );
  }

  return (
    <div className="print:p-8">
      <AppCard className="print:shadow-none print:border-0">
        <AppCard.Header className="print:pb-4">
          <div className="flex items-center justify-between">
            <div>
              <AppCard.Title>Indent View</AppCard.Title>
              <AppCard.Description>{data.indentNo || ""}</AppCard.Description>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Status</div>
                <StatusBadge
                  status={data.approvalStatus}
                  suspended={!!data.suspended}
                />
              </div>

              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Priority</div>
                <PriorityBadge priority={(data as any).priority ?? "LOW"} />
              </div>

              <AppButton
                onClick={() => router.back()}
                className="print:hidden"
                variant="secondary"
                iconName="ArrowLeft"
              >
                Back
              </AppButton>
              <AppButton
                onClick={handlePrint}
                className="print:hidden"
                iconName="Printer"
              >
                Print
              </AppButton>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg print:bg-white print:border print:border-gray-300">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Indent No
              </div>
              <div className="font-medium dark:text-white">
                {data.indentNo || "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Indent Date
              </div>
              <div className="font-medium dark:text-white">
                {data.indentDate ? formatDateDMY(data.indentDate) : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Delivery Date
              </div>
              <div className="font-medium dark:text-white">
                {data.deliveryDate ? formatDateDMY(data.deliveryDate) : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Site</div>
              <div className="font-medium dark:text-white">
                {data.site?.site || "—"}
              </div>
            </div>
            <div className="col-span-2 md:col-span-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Remarks
              </div>
              <div className="font-medium dark:text-white whitespace-pre-wrap">
                {data.remarks?.trim() ? data.remarks : "—"}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3 dark:text-white">
              Indent Items
            </h3>
            <div className="border dark:border-gray-700 rounded-lg overflow-x-auto print:border-gray-400">
              <table className="min-w-[900px] w-full">
                <thead className="bg-gray-100 dark:bg-gray-800 print:bg-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Indent Qty
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Approved 1
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Approved 2
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-200">
                      Remark
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data.indentItems || []).map((it, idx) => (
                    <tr
                      key={it.id ?? idx}
                      className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 print:hover:bg-white"
                    >
                      <td className="px-4 py-3 border-r dark:border-gray-700 dark:text-gray-200">
                        {it.item?.item || "—"}
                        {it.item?.itemCode ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {it.item.itemCode}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 border-r dark:border-gray-700 dark:text-gray-200">
                        {it.item?.unit?.unitName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                        {typeof it.indentQty === "number"
                          ? it.indentQty.toFixed(4)
                          : it.indentQty ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                        {typeof it.approved1Qty === "number"
                          ? it.approved1Qty.toFixed(4)
                          : it.approved1Qty ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                        {typeof it.approved2Qty === "number"
                          ? it.approved2Qty.toFixed(4)
                          : it.approved2Qty ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {it.remark?.trim() ? it.remark : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg dark:text-white">Approval Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg print:border print:border-gray-300">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Created
                </div>
                <div className="mt-1 text-sm dark:text-gray-300">
                  <div>By: {data.createdBy?.name || "—"}</div>
                  <div>Date: {data.createdAt ? formatDateTime(data.createdAt) : "—"}</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 dark:border dark:border-blue-800 rounded-lg print:border print:border-blue-200">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  First Approval
                </div>
                <div className="mt-1 text-sm dark:text-gray-300">
                  <div>By: {data.approved1By?.name || "—"}</div>
                  <div>Date: {data.approved1At ? formatDateTime(data.approved1At) : "—"}</div>
                </div>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 dark:border dark:border-green-800 rounded-lg print:border print:border-green-200">
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Second Approval
                </div>
                <div className="mt-1 text-sm dark:text-gray-300">
                  <div>By: {data.approved2By?.name || "—"}</div>
                  <div>Date: {data.approved2At ? formatDateTime(data.approved2At) : "—"}</div>
                </div>
              </div>

              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 dark:border dark:border-rose-800 rounded-lg print:border print:border-rose-200">
                <div className="text-sm text-rose-600 dark:text-rose-400 font-medium">
                  Suspended
                </div>
                <div className="mt-1 text-sm dark:text-gray-300">
                  <div>By: {data.suspendedBy?.name || "—"}</div>
                  <div>Date: {data.suspendedAt ? formatDateTime(data.suspendedAt) : "—"}</div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 dark:border dark:border-emerald-800 rounded-lg print:border print:border-emerald-200">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  Completed
                </div>
                <div className="mt-1 text-sm dark:text-gray-300">
                  <div>By: {data.completedBy?.name || "—"}</div>
                  <div>Date: {data.completedAt ? formatDateTime(data.completedAt) : "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
