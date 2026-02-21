"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { ComboboxInput } from "@/components/common/combobox-input";
import { AppSelect } from "@/components/common/app-select";
import useSWR from "swr";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { Upload, FileText, Trash2, Plus } from "lucide-react";

export interface OutwardDeliveryChallanFormProps {
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const inputSchema = z
  .object({
    outwardChallanDate: z.string().min(1, "Outward challan date is required"),
    challanNo: z.string().min(1, "Challan No is required"),
    challanDate: z.string().min(1, "Challan Date is required"),
    fromSiteId: z.string().min(1, "From Site is required"),
    toSiteId: z.string().min(1, "To Site is required"),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, "Item is required"),
          challanQty: z.string().optional().default(""),
          batches: z
            .array(
              z.object({
                batchNumber: z.string().optional().default(""),
                challanQty: z.string().optional().default(""),
              })
            )
            .optional()
            .default([]),
        })
      )
      .min(1, "At least one item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.fromSiteId && data.toSiteId && data.fromSiteId === data.toSiteId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toSiteId"],
        message: "To Site must be different",
      });
    }
    const seen = new Set<string>();
    (data.items || []).forEach((it, index) => {
      const id = (it.itemId || "").trim();
      if (!id) return;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "itemId"],
          message: "Duplicate item not allowed",
        });
      }
      seen.add(id);
    });
  });

type RawFormValues = z.infer<typeof inputSchema>;

function ExpiryChallanQtyDisplay({
  control,
  index,
}: {
  control: any;
  index: number;
}) {
  const batchesVal = useWatch({
    control,
    name: `items.${index}.batches` as any,
  }) as any[];

  const total = useMemo(() => {
    const sum = (batchesVal || []).reduce((acc, b) => {
      const q = b?.challanQty && b.challanQty !== "" ? Number(b.challanQty) : 0;
      return acc + (Number.isFinite(q) ? q : 0);
    }, 0);
    return sum > 0 ? String(Number(sum.toFixed(2))) : "";
  }, [batchesVal]);

  return (
    <input
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
      type="number"
      placeholder="0"
      disabled
      value={total}
      readOnly
    />
  );
}

function BatchRows({
  control,
  index,
  itemId,
  batchOptions,
  batchInfo,
}: {
  control: any;
  index: number;
  itemId: number;
  batchOptions: string[];
  batchInfo: Map<string, any>;
}) {
  const { fields: batchFields, append: appendBatch, remove: removeBatch } = useFieldArray({
    control,
    name: `items.${index}.batches` as any,
  });

  const batchesVal = useWatch({
    control,
    name: `items.${index}.batches` as any,
  }) as any[];

  return (
    <div className="mt-2 rounded-xl border bg-muted/20 p-3">
      <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground mb-2">
        <div className="col-span-4">Batch</div>
        <div className="col-span-2">Expiry</div>
        <div className="col-span-2">Batch Closing</div>
        <div className="col-span-3">Qty</div>
        <div className="col-span-1"></div>
      </div>

      {batchFields.map((f, bIndex) => {
        const batchNumber = String((batchesVal?.[bIndex] as any)?.batchNumber || "").trim();
        const info = batchNumber ? batchInfo.get(batchNumber) : null;
        const expiry = info?.expiryDate || "—";
        const closing = info ? Number(info.closingQty || 0) : 0;

        return (
          <div key={f.id} className="grid grid-cols-12 gap-3 items-start mb-2">
            <div className="col-span-4">
              <AppSelect
                control={control}
                name={`items.${index}.batches.${bIndex}.batchNumber` as any}
                placeholder="Select batch"
              >
                {batchOptions.map((o) => (
                  <AppSelect.Item key={o} value={o}>
                    {o}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div className="col-span-2 pt-2 text-sm">{expiry}</div>
            <div className="col-span-2 pt-2 text-sm">{closing}</div>
            <div className="col-span-3">
              <TextInput
                control={control}
                name={`items.${index}.batches.${bIndex}.challanQty` as any}
                label=""
                type="number"
                placeholder="0"
                span={12}
              />
            </div>
            <div className="col-span-1 pt-2">
              <button
                type="button"
                className="text-destructive inline-flex items-center text-sm"
                onClick={() => removeBatch(bIndex)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="inline-flex items-center text-sm border rounded-md px-3 py-2"
        onClick={() => appendBatch({ batchNumber: "", challanQty: "" } as any)}
      >
        <Plus className="h-4 w-4 mr-2" /> Add Batch
      </button>
    </div>
  );
}

function toSubmitPayload(
  data: RawFormValues,
  docs: Array<{ documentName: string; documentUrl: string | File | null }>
) {
  const sumBatches = (batches: Array<{ challanQty?: string }> | undefined) => {
    return Number(
      ((batches || []) as any[])
        .reduce((acc, b) => {
          const q = b?.challanQty && b.challanQty !== "" ? Number(b.challanQty) : 0;
          return acc + (Number.isFinite(q) ? q : 0);
        }, 0)
        .toFixed(2)
    );
  };

  // batches will be enriched with expiryDate using siteItems data at callsite
  const payload: any = {
    outwardChallanDate: data.outwardChallanDate || null,
    challanNo: data.challanNo?.trim() || null,
    challanDate: data.challanDate || null,
    fromSiteId: data.fromSiteId ? parseInt(data.fromSiteId) : undefined,
    toSiteId: data.toSiteId ? parseInt(data.toSiteId) : undefined,
    outwardDeliveryChallanDetails: (data.items || []).map((it) => ({
      itemId: parseInt(it.itemId),
      challanQty: (it.batches || []).length > 0 ? sumBatches(it.batches) : it.challanQty && it.challanQty !== "" ? Number(it.challanQty) : 0,
      odcDetailBatches: (it.batches || [])
        .map((b) => ({
          batchNumber: String(b.batchNumber || "").trim(),
          challanQty:
            b.challanQty && b.challanQty !== "" ? Number(b.challanQty) : 0,
        }))
        .filter((b) => !!b.batchNumber && Number(b.challanQty) > 0),
    })),
    outwardDeliveryChallanDocuments: docs.map((doc, index) => ({
      documentName: doc.documentName || "",
      documentUrl:
        typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
      index,
    })),
  };
  return payload;
}

export default function OutwardDeliveryChallanForm({
  onSuccess,
  redirectOnSuccess = "/outward-delivery-challans",
}: OutwardDeliveryChallanFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<
    Array<{
      id?: number;
      documentName: string;
      documentUrl: string | File | null;
      _tempId?: number;
    }>
  >([]);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      outwardChallanDate: "",
      challanNo: "",
      challanDate: "",
      fromSiteId: "",
      toSiteId: "",
      items: [],
    },
  });

  const { control, handleSubmit } = form;
  const {
    fields,
    replace,
  } = useFieldArray({ control, name: "items" });

  const { data: sitesResp } = useSWR<any>("/api/sites/options", apiGet);
  const siteOptions = useMemo(
    () =>
      ((sitesResp?.data as any[]) || []).map((s: any) => ({
        value: String(s.id),
        label: s.site,
      })),
    [sitesResp?.data]
  );
  const itemsVal = useWatch({ control, name: "items" }) as any[];
  const fromSiteIdVal = form.watch("fromSiteId");
  const fromSiteIdNum = useMemo(() => {
    const n = parseInt(String(fromSiteIdVal || ""), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [fromSiteIdVal]);
  const { data: siteItemsResp } = useSWR<any>(
    fromSiteIdNum ? `/api/site-items?siteId=${fromSiteIdNum}&includeBatches=1` : null,
    apiGet
  );

  const siteItemRows = useMemo(() => {
    return ((siteItemsResp?.data as any[]) || []) as any[];
  }, [siteItemsResp?.data]);

  const siteItemByItemId = useMemo(() => {
    const map = new Map<number, any>();
    siteItemRows.forEach((r: any) => {
      map.set(Number(r.itemId), r);
    });
    return map;
  }, [siteItemRows]);

  const batchInfoByItemId = useMemo(() => {
    const map = new Map<number, Map<string, any>>();
    siteItemRows.forEach((r: any) => {
      const itemId = Number(r.itemId);
      const inner = new Map<string, any>();
      ((r.siteItemBatches as any[]) || []).forEach((b: any) => {
        inner.set(String(b.batchNumber), b);
      });
      map.set(itemId, inner);
    });
    return map;
  }, [siteItemRows]);

  const batchOptionsByItemId = useMemo(() => {
    const map = new Map<number, string[]>();
    siteItemRows.forEach((r: any) => {
      const itemId = Number(r.itemId);
      const opts = ((r.siteItemBatches as any[]) || [])
        .map((b: any) => String(b.batchNumber || "").trim())
        .filter((v: string) => !!v);
      map.set(itemId, Array.from(new Set(opts)).sort());
    });
    return map;
  }, [siteItemRows]);
  const closingByItem = useMemo(() => {
    const map = new Map<number, number>();
    ((siteItemsResp?.data as any[]) || []).forEach((si: any) => {
      map.set(Number(si.itemId), Number(si.closingStock || 0));
    });
    return map;
  }, [siteItemsResp?.data]);

  const siteItemIdsKey = useMemo(() => {
    const ids = siteItemRows
      .map((r: any) => Number(r?.itemId))
      .filter((v: any) => Number.isFinite(v) && v > 0)
      .sort((a: number, b: number) => a - b);
    return ids.join(",");
  }, [siteItemRows]);

  // When fromSite is selected, auto-build rows from siteItems
  useEffect(() => {
    if (!fromSiteIdNum) {
      const current = (form.getValues("items") || []) as any[];
      if (current.length) replace([]);
      return;
    }

    const current = (form.getValues("items") || []) as any[];
    const currentKey = current
      .map((it: any) => Number(it?.itemId))
      .filter((v: any) => Number.isFinite(v) && v > 0)
      .sort((a: number, b: number) => a - b)
      .join(",");

    // Avoid re-replacing on every SWR revalidate / rerender if item list didn't change
    if (currentKey === siteItemIdsKey) return;

    const next = siteItemRows
      .map((si: any) => ({
        itemId: String(si.itemId),
        challanQty: "",
        batches: [],
      }))
      .sort((a: any, b: any) => Number(a.itemId) - Number(b.itemId));
    replace(next as any);
  }, [fromSiteIdNum, replace, siteItemRows, siteItemIdsKey, form]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      // Client-side validation: qty > 0 and <= closing stock for fromSite
      const errs: Array<string> = [];
      (data.items || []).forEach((it, index) => {
        const itemId = parseInt(String(it.itemId || 0), 10);
        const closing = closingByItem.get(itemId) ?? 0;

        const siteRow = siteItemByItemId.get(itemId);
        const isExpiry = Boolean(siteRow?.item?.isExpiryDate);
        const qty = isExpiry
          ? (it.batches || []).reduce((acc, b) => {
              const q = b?.challanQty && b.challanQty !== "" ? Number(b.challanQty) : 0;
              return acc + (Number.isFinite(q) ? q : 0);
            }, 0)
          : it.challanQty && it.challanQty !== ""
            ? Number(it.challanQty)
            : 0;

        if (!(qty > 0)) {
          errs.push(`Row ${index + 1}: Qty must be greater than 0`);
          form.setError(`items.${index}.challanQty` as any, {
            type: "manual",
            message: "Qty must be greater than 0",
          });
        } else if (qty > closing) {
          errs.push(
            `Row ${index + 1}: Qty cannot exceed closing qty (${closing})`
          );
          form.setError(`items.${index}.challanQty` as any, {
            type: "manual",
            message: `Cannot exceed closing (${closing})`,
          });
        }
        if (isExpiry) {
          const batchInfo = batchInfoByItemId.get(itemId) || new Map<string, any>();
          const used = new Set<string>();
          (it.batches || []).forEach((b, bIndex) => {
            const bn = String(b?.batchNumber || "").trim();
            const bq = b?.challanQty && b.challanQty !== "" ? Number(b.challanQty) : 0;
            if (!bn && bq > 0) {
              errs.push(`Row ${index + 1}: Batch is required`);
              form.setError(`items.${index}.batches.${bIndex}.batchNumber` as any, {
                type: "manual",
                message: "Batch is required",
              });
            }
            if (bn) {
              if (used.has(bn)) {
                errs.push(`Row ${index + 1}: Duplicate batch not allowed`);
                form.setError(`items.${index}.batches.${bIndex}.batchNumber` as any, {
                  type: "manual",
                  message: "Duplicate batch",
                });
              }
              used.add(bn);
              const info = batchInfo.get(bn);
              const bClosing = info ? Number(info.closingQty || 0) : 0;
              if (bq > bClosing) {
                errs.push(`Row ${index + 1}: Batch qty cannot exceed batch closing (${bClosing})`);
                form.setError(`items.${index}.batches.${bIndex}.challanQty` as any, {
                  type: "manual",
                  message: `Cannot exceed batch closing (${bClosing})`,
                });
              }
            }
          });
        }
      });
      if (errs.length > 0) {
        toast.error("Please fix quantity errors before submitting");
        setSubmitting(false);
        return;
      }
      const hasDocFiles = documents.some((d) => d.documentUrl instanceof File);
      if (hasDocFiles) {
        const formDataPayload = new FormData();
        const payload = toSubmitPayload(data, documents);

        // Enrich batches with expiryDate before sending
        (payload.outwardDeliveryChallanDetails || []).forEach((d: any) => {
          const info = batchInfoByItemId.get(Number(d.itemId)) || new Map<string, any>();
          if (Array.isArray(d.odcDetailBatches)) {
            d.odcDetailBatches = d.odcDetailBatches.map((b: any) => ({
              ...b,
              expiryDate: info.get(String(b.batchNumber))?.expiryDate || "",
            }));
          }
        });
        Object.entries(payload).forEach(([key, val]) => {
          if (
            key === "outwardDeliveryChallanDetails" ||
            key === "outwardDeliveryChallanDocuments"
          )
            return;
          if (val === undefined || val === null || val === "") return;
          if (val instanceof Date)
            formDataPayload.append(key, val.toISOString());
          else formDataPayload.append(key, String(val));
        });
        formDataPayload.append(
          "outwardDeliveryChallanDetails",
          JSON.stringify(payload.outwardDeliveryChallanDetails || [])
        );
        const docMetadata = documents.map((doc, index) => ({
          id: typeof doc.id === "number" && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || "",
          documentUrl:
            typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
          index,
        }));
        formDataPayload.append(
          "outwardDeliveryChallanDocuments",
          JSON.stringify(docMetadata)
        );
        documents.forEach((doc, index) => {
          if (doc.documentUrl instanceof File) {
            formDataPayload.append(
              `outwardDeliveryChallanDocuments[${index}][documentFile]`,
              doc.documentUrl,
              doc.documentUrl.name
            );
          }
        });
        const response = await fetch("/api/outward-delivery-challans", {
          method: "POST",
          body: formDataPayload,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `HTTP ${response.status}: Failed to save challan`
          );
        }
        await response.json();
      } else {
        const payload = toSubmitPayload(data, documents);

        (payload.outwardDeliveryChallanDetails || []).forEach((d: any) => {
          const info = batchInfoByItemId.get(Number(d.itemId)) || new Map<string, any>();
          if (Array.isArray(d.odcDetailBatches)) {
            d.odcDetailBatches = d.odcDetailBatches.map((b: any) => ({
              ...b,
              expiryDate: info.get(String(b.batchNumber))?.expiryDate || "",
            }));
          }
        });
        await apiPost("/api/outward-delivery-challans", payload);
      }
      toast.success("Outward Delivery Challan created");
      onSuccess?.();
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Create Outward Delivery Challan</AppCard.Title>
          <AppCard.Description>
            Add a new outward delivery challan.
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection
              legend={<span className="text-base font-semibold">General</span>}
            >
              <FormRow cols={3} from="md">
                <TextInput
                  control={control}
                  name="outwardChallanDate"
                  label="Outward Challan Date *"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="challanNo"
                  label="Challan No *"
                  placeholder="Enter challan no"
                  span={1}
                  spanFrom="md"
                />
                <TextInput
                  control={control}
                  name="challanDate"
                  label="Challan Date *"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
              </FormRow>
              <FormRow cols={2} from="md">
                <ComboboxInput
                  control={control}
                  name="fromSiteId"
                  label="From Site *"
                  options={siteOptions}
                  placeholder="Select site"
                  required
                />
                <ComboboxInput
                  control={control}
                  name="toSiteId"
                  label="To Site *"
                  options={siteOptions}
                  placeholder="Select site"
                  required
                />
              </FormRow>
            </FormSection>

            <FormSection
              legend={
                <span className="text-base font-semibold">
                  Outward Delivery Challan Details
                </span>
              }
            >
              <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-sm">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground">
                  <div className="col-span-1">Sr No</div>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Closing Qty</div>
                  <div className="col-span-2">Challan Qty</div>
                  <div className="col-span-0"></div>
                </div>
                {fields.map((field, index) => {
                  const currentItemId = String((itemsVal?.[index] as any)?.itemId || "");
                  const itemIdNum = currentItemId ? parseInt(currentItemId, 10) : NaN;
                  const siteRow = Number.isFinite(itemIdNum)
                    ? siteItemByItemId.get(itemIdNum)
                    : null;
                  const itemLabel = siteRow?.item?.itemCode
                    ? `${siteRow.item.itemCode} - ${siteRow.item.item}`
                    : siteRow?.item?.item || "—";
                  const unitName = siteRow?.item?.unit?.unitName;
                  const closing = Number.isFinite(itemIdNum)
                    ? closingByItem.get(itemIdNum) ?? 0
                    : 0;
                  const isExpiry = Boolean(siteRow?.item?.isExpiryDate);
                  return (
                    <div
                      key={field.id}
                      className="py-2 border-b"
                    >
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-1">{index + 1}</div>
                        <div className="col-span-5 text-sm">{itemLabel}</div>
                        <div className="col-span-2 text-sm">{unitName || "—"}</div>
                        <div className="col-span-2 text-sm">{closing}</div>
                        <div className="col-span-2">
                          {isExpiry ? (
                            <ExpiryChallanQtyDisplay control={control} index={index} />
                          ) : (
                            <TextInput
                              control={control}
                              name={`items.${index}.challanQty`}
                              label=""
                              type="number"
                              placeholder="0"
                              span={12}
                            />
                          )}
                        </div>
                      </div>

                      {isExpiry && Number.isFinite(itemIdNum) ? (
                        <BatchRows
                          control={control}
                          index={index}
                          itemId={itemIdNum}
                          batchOptions={batchOptionsByItemId.get(itemIdNum) || []}
                          batchInfo={batchInfoByItemId.get(itemIdNum) || new Map<string, any>()}
                        />
                      ) : null}
                    </div>
                  );
                })}
                {fields.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3">
                    Select From Site to load items.
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              legend={
                <span className="text-base font-semibold">Documents</span>
              }
            >
              <div className="space-y-4">
                {documents.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No documents added.
                  </div>
                )}
                {documents.map((doc, index) => {
                  const inputId = `odc-doc-${index}`;
                  const isFileObject =
                    doc.documentUrl &&
                    typeof doc.documentUrl !== "string" &&
                    (doc.documentUrl as File).name;
                  return (
                    <div
                      key={(doc as any)._tempId ?? doc.id ?? index}
                      className="rounded-2xl border p-4 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-2 min-w-0">
                            <label className="text-sm font-semibold">
                              Document Name
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              className="mt-2 w-full rounded-lg border border-muted bg-background px-3 py-2 text-sm"
                              value={doc.documentName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDocuments((prev) =>
                                  prev.map((d, i) =>
                                    i === index ? { ...d, documentName: v } : d
                                  )
                                );
                              }}
                              placeholder="e.g. Invoice, LR, Ewaybill"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-destructive inline-flex items-center text-sm"
                          onClick={() =>
                            setDocuments((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">
                          File<span className="text-red-500">*</span>
                        </label>
                        <label
                          htmlFor={inputId}
                          className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {isFileObject
                                  ? (doc.documentUrl as File).name
                                  : "Click to select a file"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, PDF up to 20 MB.
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
                            Browse
                          </span>
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setDocuments((prev) =>
                              prev.map((d, i) =>
                                i === index ? { ...d, documentUrl: file } : d
                              )
                            );
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center text-sm border rounded-md px-3 py-2"
                    onClick={() =>
                      setDocuments((prev) => [
                        ...prev,
                        {
                          documentName: "",
                          documentUrl: null,
                          _tempId: -Date.now(),
                        },
                      ])
                    }
                  >
                    <Upload className="h-4 w-4 mr-2" /> Add Document
                  </button>
                </div>
              </div>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push(redirectOnSuccess)}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName="Plus"
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              Create Challan
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
