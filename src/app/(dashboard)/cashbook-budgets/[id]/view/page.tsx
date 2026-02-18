"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/locales";

type CashbookBudgetData = {
  id: number;
  name: string;
  month: string;
  totalBudget: number;
  approvedBudgetAmount: number | null;
  approved1BudgetAmount: number | null;
  siteId: number;
  boqId: number | null;
  attachCopyUrl: string | null;
  approved1Remarks: string | null;
  remarksForFinalApproval: string | null;
  approvedBy: number | null;
  approvedDatetime: string | null;
  approved1By: number | null;
  approved1Datetime: string | null;
  acceptedBy: number | null;
  acceptedDatetime: string | null;
  site: { id: number; site: string };
  boq: { id: number; boqNo: string | null } | null;
  approvedBy_user: { id: number; name: string | null } | null;
  approved1By_user: { id: number; name: string | null } | null;
  acceptedBy_user: { id: number; name: string | null } | null;
  budgetItems: Array<{
    id: number;
    cashbookHeadId: number;
    description: string | null;
    amount: number;
    date: string | null;
    approvedAmount: number | null;
    approved1Amount: number | null;
    cashbookHead: { id: number; cashbookHeadName: string };
  }>;
  createdAt: string;
  updatedAt: string;
};

export default function ViewCashbookBudgetPage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading, error } = useSWR<CashbookBudgetData>(
    params?.id ? `/api/cashbook-budgets/${params.id}` : null,
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
        <div className="text-muted-foreground">Budget not found</div>
      </div>
    );
  }

  return (
    <div className="print:p-8">
      <AppCard className="print:shadow-none print:border-0">
        <AppCard.Header className="print:pb-4">
          <div className="flex items-center justify-between">
            <div>
              <AppCard.Title>Cashbook Budget View</AppCard.Title>
              <AppCard.Description>
                {data.name} - {data.month}
              </AppCard.Description>
            </div>
            <AppButton
              onClick={handlePrint}
              className="print:hidden"
              iconName="Printer"
            >
              Print
            </AppButton>
          </div>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {/* Budget Header Information */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg print:bg-white print:border print:border-gray-300">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Budget Name
              </div>
              <div className="font-medium dark:text-white">{data.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Month
              </div>
              <div className="font-medium dark:text-white">{data.month}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Site
              </div>
              <div className="font-medium dark:text-white">
                {data.site.site}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                BOQ
              </div>
              <div className="font-medium dark:text-white">
                {data.boq?.boqNo || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Created Date
              </div>
              <div className="font-medium dark:text-white">
                {new Date(data.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* Budget Items Table */}
          <div>
            <h3 className="font-semibold text-lg mb-3 dark:text-white">
              Budget Items
            </h3>
            <div className="border dark:border-gray-700 rounded-lg overflow-hidden print:border-gray-400">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800 print:bg-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Cashbook Head
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                      Budget Amount
                    </th>
                    {data.approved1By && (
                      <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">
                        Approved Amount
                      </th>
                    )}
                    {data.approvedBy && (
                      <th className="px-4 py-3 text-right text-sm font-medium dark:text-gray-200">
                        Final Approved
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.budgetItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 print:hover:bg-white"
                    >
                      <td className="px-4 py-3 border-r dark:border-gray-700 dark:text-gray-200">
                        {item.cashbookHead.cashbookHeadName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border-r dark:border-gray-700">
                        {item.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border-r dark:border-gray-700">
                        {item.date
                          ? new Date(item.date).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                        {formatCurrency(Number(item.amount))}
                      </td>
                      {data.approved1By && (
                        <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 border-r dark:border-gray-700">
                          {formatCurrency(Number(item.approved1Amount || 0))}
                        </td>
                      )}
                      {data.approvedBy && (
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                          {formatCurrency(Number(item.approvedAmount || 0))}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-gray-800 font-bold print:bg-gray-200">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-3 border-r dark:border-gray-700 dark:text-gray-200"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                      {formatCurrency(Number(data.totalBudget))}
                    </td>
                    {data.approved1By && (
                      <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 border-r dark:border-gray-700">
                        {formatCurrency(Number(data.approved1BudgetAmount || 0))}
                      </td>
                    )}
                    {data.approvedBy && (
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                        {formatCurrency(Number(data.approvedBudgetAmount || 0))}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Approval Information */}
          {(data.approvedBy || data.approved1By || data.acceptedBy) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg dark:text-white">
                Approval Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.approved1By && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 dark:border dark:border-blue-800 rounded-lg print:border print:border-blue-200">
                    <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      First Approval
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {data.approved1By_user?.name || "Unknown"}</div>
                      <div>
                        Date:{" "}
                        {data.approved1Datetime
                          ? new Date(data.approved1Datetime).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
                {data.approvedBy && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 dark:border dark:border-green-800 rounded-lg print:border print:border-green-200">
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Final Approval
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {data.approvedBy_user?.name || "Unknown"}</div>
                      <div>
                        Date:{" "}
                        {data.approvedDatetime
                          ? new Date(data.approvedDatetime).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
                {data.acceptedBy && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 dark:border dark:border-purple-800 rounded-lg print:border print:border-purple-200">
                    <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                      Accepted
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {data.acceptedBy_user?.name || "Unknown"}</div>
                      <div>
                        Date:{" "}
                        {data.acceptedDatetime
                          ? new Date(data.acceptedDatetime).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {(data.approved1Remarks || data.remarksForFinalApproval) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg dark:text-white">Remarks</h3>
              {data.approved1Remarks && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    First Approval Remarks
                  </div>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 rounded border dark:border-gray-700 print:border-gray-300">
                    {data.approved1Remarks}
                  </div>
                </div>
              )}
              {data.remarksForFinalApproval && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Final Approval Remarks
                  </div>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 rounded border dark:border-gray-700 print:border-gray-300">
                    {data.remarksForFinalApproval}
                  </div>
                </div>
              )}
            </div>
          )}
        </AppCard.Content>
      </AppCard>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
