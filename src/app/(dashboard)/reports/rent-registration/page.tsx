"use client";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileSpreadsheet } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RentRegistrationReportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<string>("all");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (status !== "all") params.set("status", status);
    const qs = params.toString();
    return "/api/reports/rent-registration" + (qs ? `?${qs}` : "");
  }, [fromDate, toDate, status]);

  const { data, isLoading } = useSWR(query, fetcher);

  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function exportPdf() {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (status !== "all") params.set("status", status);
    const url = `/api/reports/rent-registration-pdf?${params.toString()}`;
    window.open(url, '_blank');
    toast.success("PDF opened in new tab");
  }

  function exportExcel() {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (status !== "all") params.set("status", status);
    const url = `/api/reports/rent-registration-excel?${params.toString()}`;
    const fname = `rent-registration-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadFile(url, fname);
  }

  // Group data by site and boq
  const groupedData = useMemo(() => {
    if (!data?.data) return [];
    const groups: any[] = [];
    data.data.forEach((rent: any) => {
      const key = `${rent.siteId}-${rent.boqId}`;
      let group = groups.find(g => g.key === key);
      if (!group) {
        group = {
          key,
          siteName: rent.site?.site || 'N/A',
          boqNo: rent.boq?.boqNo || 'N/A',
          rents: [],
          totalDeposit: 0,
          totalRent: 0
        };
        groups.push(group);
      }
      group.rents.push(rent);
      group.totalDeposit += Number(rent.depositAmount || 0);
      group.totalRent += Number(rent.rentAmount || 0);
    });
    return groups;
  }, [data]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return groupedData.reduce((acc, group) => ({
      deposit: acc.deposit + group.totalDeposit,
      rent: acc.rent + group.totalRent
    }), { deposit: 0, rent: 0 });
  }, [groupedData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Rent Registration Report</h1>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-2">From Date</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To Date</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 col-span-1 md:col-span-3 lg:col-span-2">
            <Button onClick={exportPdf} disabled={isLoading} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={exportExcel} disabled={isLoading} variant="outline" className="flex-1">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Data */}
      {isLoading && <div className="text-center py-8">Loading...</div>}
      
      {!isLoading && groupedData.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No data found for the selected filters
        </Card>
      )}

      {!isLoading && groupedData.length > 0 && (
        <div className="space-y-6">
          <Accordion type="single" collapsible className="space-y-4">
            {groupedData.map((group, index) => (
              <AccordionItem key={group.key} value={`item-${index}`} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex justify-between items-center w-full pr-4">
                    <span className="font-semibold text-left">
                      {group.boqNo} - {group.siteName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {group.rents.length} {group.rents.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Owner</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Rent Category</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Rent Type</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Due Date</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Deposit Amount</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Rent Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.rents.map((rent: any) => (
                          <tr key={rent.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                            <td className="px-4 py-2 text-sm">{rent.owner || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm">{rent.rentalCategory?.rentalCategory || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm">{rent.rentType?.rentType || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm">{rent.description || '-'}</td>
                            <td className="px-4 py-2 text-sm">
                              {rent.dueDate ? new Date(rent.dueDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`inline-block px-2 py-1 rounded text-xs ${
                                rent.status === 'Paid' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {rent.status || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {Number(rent.depositAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {Number(rent.rentAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
                          <td colSpan={6} className="px-4 py-2 text-sm text-right">Total</td>
                          <td className="px-4 py-2 text-sm text-right">{group.totalDeposit.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">{group.totalRent.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Grand Total */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <div className="px-6 py-2.5">
              <div className="flex flex-wrap justify-end gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Grand Total Deposit:</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{grandTotals.deposit.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Grand Total Rent:</span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{grandTotals.rent.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
