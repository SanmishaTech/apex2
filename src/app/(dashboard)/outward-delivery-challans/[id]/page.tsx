"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDate } from "@/lib/locales";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function ViewOutwardDeliveryChallanPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();

  const { data, isLoading, error } = useSWR<any>(
    Number.isFinite(id) ? `/api/outward-delivery-challans/${id}` : null,
    apiGet
  );

  const challan = data ?? null;
  const { can } = usePermissions();
  const { user } = useCurrentUser();
  const uid = (user as any)?.id as number | undefined;
  const createdById = challan?.createdBy?.id as number | undefined;
  const approved1ById = challan?.approved1ById as number | undefined;
  const canApprove =
    !!challan &&
    !challan.isApproved1 &&
    can(PERMISSIONS.APPROVE_OUTWARD_DELIVERY_CHALLAN) &&
    uid !== createdById;
  const canAccept =
    !!challan &&
    challan.isApproved1 &&
    !challan.isAccepted &&
    can(PERMISSIONS.ACCEPT_OUTWARD_DELIVERY_CHALLAN) &&
    uid !== createdById &&
    uid !== approved1ById;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Outward Delivery Challan</AppCard.Title>
        <AppCard.Description>View challan details.</AppCard.Description>
        <AppCard.Action>
          <div className="flex items-center gap-2">
            {canApprove && (
              <Link href={`/outward-delivery-challans/${id}/approve`}>
                <AppButton size="sm" type="button" iconName="Check">Approve</AppButton>
              </Link>
            )}
            {canAccept && (
              <Link href={`/outward-delivery-challans/${id}/accept`}>
                <AppButton size="sm" type="button" iconName="CheckCircle">Accept</AppButton>
              </Link>
            )}
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              iconName="ArrowLeft"
              onClick={() => router.push("/outward-delivery-challans")}
            >
              Back
            </AppButton>
          </div>
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
                  <div className="text-muted-foreground">Outward Challan No.</div>
                  <div className="font-medium">{challan.outwardChallanNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Outward Challan Date</div>
                  <div className="font-medium">
                    {challan.outwardChallanDate ? formatDate(challan.outwardChallanDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Challan No.</div>
                  <div className="font-medium">{challan.challanNo || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Challan Date</div>
                  <div className="font-medium">{challan.challanDate ? formatDate(challan.challanDate) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">From Site</div>
                  <div className="font-medium">{challan.fromSite?.site || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">To Site</div>
                  <div className="font-medium">{challan.toSite?.site || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Prepared By</div>
                  <div className="font-medium">{challan.createdBy?.name || "—"}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Outward Delivery Challan Details</h3>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-3 p-3 text-xs font-medium bg-muted/50">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Challan Qty</div>
                  <div className="col-span-2"></div>
                </div>
                {(challan.outwardDeliveryChallanDetails || []).map((d: any) => {
                  const item = d.item;
                  const unit = item?.unit?.unitName;
                  return (
                    <div key={d.id} className="grid grid-cols-12 gap-3 p-3 border-t text-sm">
                      <div className="col-span-6">
                        {item?.itemCode ? `${item.itemCode} - ${item.item}` : item?.item ?? "—"}
                      </div>
                      <div className="col-span-2">{unit || "—"}</div>
                      <div className="col-span-2">{d.challanQty ?? "—"}</div>
                      <div className="col-span-2"></div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Documents</h3>
              {(challan.outwardDeliveryChallanDocuments || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No documents</div>
              ) : (
                <div className="space-y-2">
                  {challan.outwardDeliveryChallanDocuments.map((doc: any) => {
                    const url: string = doc.documentUrl;
                    const href = url.startsWith("/uploads/") ? `/api${url}` : url;
                    return (
                      <div key={doc.id} className="flex justify-between items-center rounded border p-3 text-sm">
                        <div>
                          <div className="font-medium">{doc.documentName}</div>
                        </div>
                        <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-primary">
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
