"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet, apiPatch } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { formatDate } from "@/lib/locales";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextInput } from "@/components/common/text-input";
import { Form } from "@/components/ui/form";
import { FormSection } from "@/components/common/app-form";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

const rowSchema = z.object({
  id: z.number(),
  approved1Qty: z
    .string()
    .trim()
    .refine((v) => v !== "", { message: "Qty is required" })
    .refine((v) => !Number.isNaN(Number(v)), { message: "Invalid number" })
    .refine((v) => Number(v) > 0, { message: "Qty must be greater than 0" }),
});
const formSchema = z.object({ details: z.array(rowSchema).min(1) });

type FormValues = z.infer<typeof formSchema>;

export default function ApproveOutwardDeliveryChallanPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const { can } = usePermissions();
  const allowed = can(PERMISSIONS.APPROVE_OUTWARD_DELIVERY_CHALLAN);

  useEffect(() => {
    if (allowed) return;
    toast.error("You do not have permission to approve outward delivery challan");
    router.replace("/outward-delivery-challans");
  }, [allowed, router]);

  const {
    data: challan,
    isLoading,
    error,
    mutate,
  } = useSWR<any>(
    allowed && Number.isFinite(id) ? `/api/outward-delivery-challans/${id}` : null,
    apiGet
  );

  // Closing stock by item at fromSite
  const fromSiteId = challan?.fromSiteId as number | undefined;
  const { data: siteItemsResp } = useSWR<any>(
    fromSiteId ? `/api/site-items?siteId=${fromSiteId}` : null,
    apiGet
  );
  const closingByItem = useMemo(() => {
    const map = new Map<number, number>();
    ((siteItemsResp?.data as any[]) || []).forEach((si: any) => {
      map.set(Number(si.itemId), Number(si.closingStock || 0));
    });
    return map;
  }, [siteItemsResp?.data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { details: [] },
  });

  const { control, handleSubmit, reset } = form;
  useEffect(() => {
    if (!challan) return;
    reset({
      details: (challan.outwardDeliveryChallanDetails || []).map((d: any) => ({
        id: d.id,
        approved1Qty: d.approved1Qty != null ? String(d.approved1Qty) : "",
      })),
    });
  }, [challan, reset]);

  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      // Client validation: <= closing stock
      const detailsById = new Map<number, any>();
      (challan?.outwardDeliveryChallanDetails || []).forEach((d: any) =>
        detailsById.set(d.id, d)
      );
      let hadErr = false;
      values.details.forEach((d, idx) => {
        const detail = detailsById.get(d.id);
        const itemId = Number(detail?.itemId || 0);
        const closing = closingByItem.get(itemId) ?? 0;
        if (Number(d.approved1Qty) > closing) {
          hadErr = true;
          form.setError(`details.${idx}.approved1Qty` as any, {
            type: "manual",
            message: `Cannot exceed closing (${closing})`,
          });
        }
      });
      if (hadErr) {
        toast.error("Approved qty cannot exceed closing stock");
        setSubmitting(false);
        return;
      }
      const payload = {
        statusAction: "approve" as const,
        outwardDeliveryChallanDetails: values.details.map((d) => ({
          id: d.id,
          approved1Qty: Number(d.approved1Qty),
        })),
      };
      await apiPatch(`/api/outward-delivery-challans/${id}`, payload);
      toast.success("Challan approved");
      await mutate();
      router.push(`/outward-delivery-challans`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Approve Outward Delivery Challan</AppCard.Title>
        <AppCard.Description>
          Review and approve quantities.
        </AppCard.Description>
        <AppCard.Action>
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            iconName="ArrowLeft"
            onClick={() => router.push(`/outward-delivery-challans/${id}`)}
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
          <Form {...form}>
            <form noValidate onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-8">
                <section>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">
                        Outward Challan No.
                      </div>
                      <div className="font-medium">
                        {challan.outwardChallanNo || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Outward Challan Date
                      </div>
                      <div className="font-medium">
                        {challan.outwardChallanDate
                          ? formatDate(challan.outwardChallanDate)
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Challan No.</div>
                      <div className="font-medium">
                        {challan.challanNo || "—"}
                      </div>
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
                      <div className="text-muted-foreground">From Site</div>
                      <div className="font-medium">
                        {challan.fromSite?.site || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">To Site</div>
                      <div className="font-medium">
                        {challan.toSite?.site || "—"}
                      </div>
                    </div>
                  </div>
                </section>

                <FormSection
                  legend={
                    <span className="text-base font-semibold">
                      Outward Delivery Challan Details
                    </span>
                  }
                >
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 gap-3 p-3 text-xs font-medium bg-muted/50">
                      <div className="col-span-4">Item</div>
                      <div className="col-span-2">Unit</div>
                      <div className="col-span-2">Challan Qty</div>
                      <div className="col-span-2">Closing Qty</div>
                      <div className="col-span-2">Approved Qty</div>
                    </div>
                    {(challan.outwardDeliveryChallanDetails || []).map(
                      (d: any, idx: number) => {
                        const inputName =
                          `details.${idx}.approved1Qty` as const;
                        const closing =
                          closingByItem.get(Number(d.itemId)) ?? 0;
                        return (
                          <div
                            key={d.id}
                            className="grid grid-cols-12 gap-3 p-3 border-t text-sm items-center"
                          >
                            <div className="col-span-4">
                              {d.item?.itemCode
                                ? `${d.item.itemCode} - ${d.item.item}`
                                : d.item?.item ?? "—"}
                            </div>
                            <div className="col-span-2">
                              {d.item?.unit?.unitName || "—"}
                            </div>
                            <div className="col-span-2">
                              {d.challanQty ?? "—"}
                            </div>
                            <div className="col-span-2">{closing}</div>
                            <div className="col-span-2">
                              <TextInput
                                control={control}
                                name={inputName}
                                label=""
                                type="number"
                                placeholder="0"
                                span={12}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </FormSection>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <AppButton
                  type="submit"
                  iconName="Check"
                  isLoading={submitting}
                  disabled={submitting}
                >
                  Approve
                </AppButton>
              </div>
            </form>
          </Form>
        ) : (
          <div className="text-sm text-muted-foreground">No data</div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
