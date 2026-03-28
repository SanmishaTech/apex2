"use client";

import { use } from "react";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { FormSection, FormRow } from "@/components/common/app-form";

function UserBadge({ name, className }: { name?: string | null; className: string }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${className}`}>
      {name}
    </span>
  );
}
import { SubContractorWorkOrder } from "@/types/sub-contractor-work-orders";

function formatDateDmy(date?: string | Date | null) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

export default function ViewSubContractorWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useSWR<{ data: SubContractorWorkOrder }>(`/api/sub-contractor-work-orders/${id}`, apiGet);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data?.data) return <div className="p-8 text-center">Work order not found</div>;

  const swo = data.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">View SubContractor Work Order</h1>
      <AppCard>
        <AppCard.Content>
          <FormSection title="General Information">
            <FormRow cols={3}>
              <div>
                <div className="text-xs text-muted-foreground">WO Date</div>
                <div className="font-medium">{formatDateDmy(swo.workOrderDate)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Site</div>
                <div className="font-medium">{swo.site?.site || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">BOQ</div>
                <div className="font-medium">{swo.boq?.boqNo || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SubContractor</div>
                <div className="font-medium">{swo.subContractor?.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Vendor</div>
                <div className="font-medium">{swo.vendor?.vendorName || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Billing Address</div>
                <div className="font-medium">{swo.billingAddress?.addressLine1 ? `${swo.billingAddress.addressLine1}, ${swo.billingAddress.city?.city || ''}` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Type of WO</div>
                <div className="font-medium">{swo.typeOfWorkOrder || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium">{swo.status || '—'}</div>
              </div>
            </FormRow>
          </FormSection>

          <FormSection title="Delivery & Payments" className="mt-6">
            <FormRow cols={3}>
              <div>
                <div className="text-xs text-muted-foreground">Delivery Date</div>
                <div className="font-medium">{formatDateDmy(swo.deliveryDate)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payment Terms</div>
                <div className="font-medium">{(swo.subContractorWorkOrderPaymentTerms || []).map(p => p.paymentTerm?.paymentTerm).filter(Boolean).join(', ') || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Note</div>
                <div className="font-medium">{swo.note || '—'}</div>
              </div>
            </FormRow>
          </FormSection>

          <FormSection title="Work Order Items" className="mt-6">
            <div className="w-full overflow-x-auto rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="w-full border-collapse bg-transparent text-[12px]">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-2 py-2 text-left">Item</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Unit</th>
                    <th className="px-2 py-2 text-right">Rate</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(swo.subContractorWorkOrderDetails || []).map((it: any) => (
                    <tr key={it.id} className="border-b">
                      <td className="px-2 py-2 align-top">{it.item || '—'}</td>
                      <td className="px-2 py-2 text-right">{it.qty?.toLocaleString?.('en-IN') || it.qty || '—'}</td>
                      <td className="px-2 py-2 text-right">{it.unit?.unitName || '—'}</td>
                      <td className="px-2 py-2 text-right">{Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-2 text-right">{Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>

          <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm">
            <span className="text-muted-foreground">Total CGST:</span>
            <span className="text-right">{(swo.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-muted-foreground">Total SGST:</span>
            <span className="text-right">{(swo.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-muted-foreground">Total IGST:</span>
            <span className="text-right">{(swo.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-lg font-bold border-t pt-1">Grand Total:</span>
            <span className="text-lg font-bold border-t pt-1 text-right">{(swo.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

        </AppCard.Content>
      </AppCard>
    </div>
  );
}
