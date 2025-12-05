"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDate } from "@/lib/locales";

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
                  return (
                    <div
                      key={d.id}
                      className="grid grid-cols-12 gap-3 p-3 border-t text-sm"
                    >
                      <div className="col-span-4">
                        {item?.itemCode
                          ? `${item.itemCode} - ${item.item}`
                          : item?.item ?? "—"}
                      </div>
                      <div className="col-span-1">{unit || "—"}</div>
                      <div className="col-span-2">{d.issuedQty ?? "—"}</div>
                      <div className="col-span-2">{d.receivedQty ?? "—"}</div>
                      <div className="col-span-1">
                        {Number(d.rate ?? 0).toFixed(2)}
                      </div>
                      <div className="col-span-1">
                        {Number(d.amount ?? 0).toFixed(2)}
                      </div>
                      <div className="col-span-1 text-right">
                        {closingStock ?? "—"}
                      </div>
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
