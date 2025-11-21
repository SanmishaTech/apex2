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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">
                    Inward Challan No.
                  </div>
                  <div className="font-medium">
                    {challan.inwardChallanNo || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    Material Received Date
                  </div>
                  <div className="font-medium">
                    {challan.inwardChallanDate
                      ? formatDate(challan.inwardChallanDate)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    Purchase Order No.
                  </div>
                  <div className="font-medium">
                    {challan.purchaseOrder?.purchaseOrderNo || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Challan No.</div>
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
                  <div className="text-muted-foreground">L.R. No.</div>
                  <div className="font-medium">{challan.lrNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">L.R. Date</div>
                  <div className="font-medium">
                    {challan.lRDate ? formatDate(challan.lRDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vehicle No.</div>
                  <div className="font-medium">{challan.vehicleNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Site</div>
                  <div className="font-medium">{challan.site?.site || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vendor</div>
                  <div className="font-medium">
                    {challan.vendor?.vendorName || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Prepared By</div>
                  <div className="font-medium">
                    {challan.createdBy?.name || "—"}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">
                Inward Delivery Challan Details
              </h3>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-3 p-3 text-xs font-medium bg-muted/50">
                  <div className="col-span-4">Item</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Received Qty</div>
                  <div className="col-span-2 text-right">Closing Stock</div>
                </div>
                {(challan.inwardDeliveryChallanDetails || []).map((d: any) => {
                  const item = d.poDetails?.item;
                  const unit = item?.unit?.unitName;
                  const qty = d.poDetails?.qty;
                  const receivedQty = d.receivingQty;
                  const itemId: number | undefined = d.poDetails?.itemId;
                  const closingStockMap = challan.closingStockByItemId || {};
                  const closingStock = itemId
                    ? closingStockMap[itemId]
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
                      <div className="col-span-2">{unit || "—"}</div>
                      <div className="col-span-2">{qty ?? "—"}</div>
                      <div className="col-span-2">{receivedQty ?? "—"}</div>
                      <div className="col-span-2 text-right">
                        {closingStock ?? "—"}
                      </div>
                    </div>
                  );
                })}
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
