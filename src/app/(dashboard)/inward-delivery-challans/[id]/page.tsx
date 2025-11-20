"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDate } from "@/lib/locales";

export default function ViewInwardDeliveryChallanPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();

  const { data, isLoading, error } = useSWR<any>(
    Number.isFinite(id) ? `/api/inward-delivery-challans/${id}` : null,
    apiGet
  );

  const challan = data ?? null;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Inward Delivery Challan</AppCard.Title>
        <AppCard.Description>View challan details.</AppCard.Description>
        <AppCard.Action>
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            iconName="ArrowLeft"
            onClick={() => router.push("/inward-delivery-challans")}
          >
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-sm text-destructive">Failed to load</div>
        ) : challan ? (
          <div className="space-y-8">
            <section>
              <h3 className="text-base font-semibold mb-3">General</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">IDC No</div>
                  <div className="font-medium">{challan.inwardChallanNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">IDC Date</div>
                  <div className="font-medium">
                    {challan.inwardChallanDate
                      ? formatDate(challan.inwardChallanDate)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Challan No</div>
                  <div className="font-medium">{challan.challanNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Challan Date</div>
                  <div className="font-medium">
                    {challan.challanDate
                      ? formatDate(challan.challanDate)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">PO</div>
                  <div className="font-medium">
                    {challan.purchaseOrder?.purchaseOrderNo}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vendor</div>
                  <div className="font-medium">
                    {challan.vendor?.vendorName || challan.vendorId}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Site</div>
                  <div className="font-medium">
                    {challan.site?.site || challan.siteId}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vehicle No</div>
                  <div className="font-medium">{challan.vehicleNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">{challan.status}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">
                Amounts & Payment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Bill Amount</div>
                  <div className="font-medium">
                    {challan.billAmount != null
                      ? String(challan.billAmount)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Deduction Tax</div>
                  <div className="font-medium">
                    {challan.deductionTax != null
                      ? String(challan.deductionTax)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Paid Amount</div>
                  <div className="font-medium">
                    {challan.paidAmount != null
                      ? String(challan.paidAmount)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Paid Amount</div>
                  <div className="font-medium">
                    {challan.totalPaidAmount != null
                      ? String(challan.totalPaidAmount)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due Days</div>
                  <div className="font-medium">{challan.dueDays}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due Date</div>
                  <div className="font-medium">
                    {challan.dueDate ? formatDate(challan.dueDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment Mode</div>
                  <div className="font-medium">
                    {challan.paymentMode || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment Date</div>
                  <div className="font-medium">
                    {challan.paymentDate
                      ? formatDate(challan.paymentDate)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cheque No</div>
                  <div className="font-medium">{challan.chequeNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cheque Date</div>
                  <div className="font-medium">
                    {challan.chequeDate ? formatDate(challan.chequeDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">UTR No</div>
                  <div className="font-medium">{challan.utrNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bank Name</div>
                  <div className="font-medium">{challan.bankName || "—"}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Details</h3>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-3 p-3 text-xs font-medium bg-muted/50">
                  <div className="col-span-3">PO Detail ID</div>
                  <div className="col-span-3">Receiving Qty</div>
                  <div className="col-span-3">Rate</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
                {(challan.inwardDeliveryChallanDetails || []).map((d: any) => (
                  <div
                    key={d.id}
                    className="grid grid-cols-12 gap-3 p-3 border-t text-sm"
                  >
                    <div className="col-span-3">{d.poDetailsId}</div>
                    <div className="col-span-3">{d.receivingQty}</div>
                    <div className="col-span-3">{d.rate}</div>
                    <div className="col-span-3 text-right">{d.amount}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Documents</h3>
              {(challan.inwardDeliveryChallanDocuments || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No documents
                </div>
              ) : (
                <div className="space-y-2">
                  {challan.inwardDeliveryChallanDocuments.map((doc: any) => {
                    const url: string = doc.documentUrl;
                    const href = url.startsWith("/uploads/")
                      ? `/api${url}`
                      : url;
                    return (
                      <div
                        key={doc.id}
                        className="flex justify-between items-center rounded border p-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{doc.documentName}</div>
                          <div className="text-xs text-muted-foreground break-all">
                            {url}
                          </div>
                        </div>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-primary"
                        >
                          View
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No data</div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
