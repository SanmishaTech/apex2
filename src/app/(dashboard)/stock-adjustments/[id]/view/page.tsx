"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDate } from "@/lib/locales";

const fmtINR0to2 = new Intl.NumberFormat("en-IN", {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const fmtINR2 = new Intl.NumberFormat("en-IN", {
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function n(v: any) {
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}

export default function ViewStockAdjustmentPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();

  const { data, isLoading, error } = useSWR<any>(
    Number.isFinite(id) ? `/api/stock-adjustments/${id}` : null,
    apiGet
  );

  const sa = data ?? null;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Stock Adjustment</AppCard.Title>
        <AppCard.Description>View adjustment details.</AppCard.Description>
        <AppCard.Action>
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            iconName="ArrowLeft"
            onClick={() => router.push("/stock-adjustments")}
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
        ) : sa ? (
          <div className="space-y-8">
            <section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-medium">
                    {sa.date ? formatDate(sa.date) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Site</div>
                  <div className="font-medium">{sa.site?.site || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Prepared By</div>
                  <div className="font-medium">{sa.createdBy?.name || "—"}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Details</h3>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-3 p-3 text-xs font-medium bg-muted/50">
                  <div className="col-span-4">Item</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2">Issued</div>
                  <div className="col-span-2">Received</div>
                  <div className="col-span-1">Rate</div>
                  <div className="col-span-1">Amount</div>
                  <div className="col-span-1 text-right">Closing</div>
                </div>
                {(sa.stockAdjustmentDetail || []).map((d: any) => {
                  const item = d.item;
                  const unit = item?.unit?.unitName;
                  const closingStockMap = sa.closingStockByItemId || {};
                  const closingStock = d.itemId
                    ? closingStockMap[d.itemId]
                    : undefined;
                  const batches: any[] = Array.isArray(d.stockAdjustmentDetailBatch)
                    ? d.stockAdjustmentDetailBatch
                    : [];
                  return (
                    <div key={d.id} className="border-t">
                      <div className="grid grid-cols-12 gap-3 p-3 text-sm">
                        <div className="col-span-4">
                          {item?.itemCode
                            ? `${item.itemCode} - ${item.item}`
                            : item?.item ?? "—"}
                        </div>
                        <div className="col-span-1">{unit || "—"}</div>
                        <div className="col-span-2">{fmtINR0to2.format(n(d.issuedQty ?? 0))}</div>
                        <div className="col-span-2">{fmtINR0to2.format(n(d.receivedQty ?? 0))}</div>
                        <div className="col-span-1">{fmtINR2.format(n(d.rate ?? 0))}</div>
                        <div className="col-span-1">{fmtINR2.format(n(d.amount ?? 0))}</div>
                        <div className="col-span-1 text-right">
                          {closingStock ?? "—"}
                        </div>
                      </div>

                      {d.remarks ? (
                        <div className="px-3 pb-3 text-xs text-muted-foreground">
                          {d.remarks}
                        </div>
                      ) : null}

                      {batches.length > 0 ? (
                        <div className="px-3 pb-3">
                          <div className="rounded-md border bg-muted/20">
                            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                              <div className="col-span-3">Batch No.</div>
                              <div className="col-span-2">Expiry</div>
                              <div className="col-span-2">Issued</div>
                              <div className="col-span-2">Received</div>
                              <div className="col-span-1 text-right">Rate</div>
                              <div className="col-span-2 text-right">Amount</div>
                            </div>
                            {batches.map((b: any) => (
                              <div
                                key={b.id}
                                className="grid grid-cols-12 gap-3 px-3 py-2 border-t text-xs"
                              >
                                <div className="col-span-3 font-medium">
                                  {b.batchNumber || "—"}
                                </div>
                                <div className="col-span-2">{b.expiryDate || "—"}</div>
                                <div className="col-span-2">
                                  {fmtINR0to2.format(n(b.batchIssuedQty ?? 0))}
                                </div>
                                <div className="col-span-2">
                                  {fmtINR0to2.format(n(b.batchReceivedQty ?? 0))}
                                </div>
                                <div className="col-span-1 text-right">
                                  {fmtINR2.format(n(b.unitRate ?? 0))}
                                </div>
                                <div className="col-span-2 text-right">
                                  {fmtINR2.format(n(b.amount ?? 0))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No data</div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
