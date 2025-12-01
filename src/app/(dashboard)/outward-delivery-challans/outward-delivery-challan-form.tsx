"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { ComboboxInput } from "@/components/common/combobox-input";
import useSWR from "swr";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { Upload, FileText, Trash2 } from "lucide-react";

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
          challanQty: z.string().min(1, "Qty is required"),
        })
      )
      .min(1, "At least one item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.fromSiteId && data.toSiteId && data.fromSiteId === data.toSiteId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toSiteId"], message: "To Site must be different" });
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

function toSubmitPayload(
  data: RawFormValues,
  docs: Array<{ documentName: string; documentUrl: string | File | null }>
) {
  const payload: any = {
    outwardChallanDate: data.outwardChallanDate || null,
    challanNo: data.challanNo?.trim() || null,
    challanDate: data.challanDate || null,
    fromSiteId: data.fromSiteId ? parseInt(data.fromSiteId) : undefined,
    toSiteId: data.toSiteId ? parseInt(data.toSiteId) : undefined,
    outwardDeliveryChallanDetails: (data.items || []).map((it) => ({
      itemId: parseInt(it.itemId),
      challanQty: it.challanQty && it.challanQty !== "" ? Number(it.challanQty) : 0,
    })),
    outwardDeliveryChallanDocuments: docs.map((doc, index) => ({
      documentName: doc.documentName || "",
      documentUrl: typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
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
    Array<{ id?: number; documentName: string; documentUrl: string | File | null; _tempId?: number }>
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
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const { data: sitesResp } = useSWR<any>("/api/sites/options", apiGet);
  const { data: itemsResp } = useSWR<any>("/api/items/options", apiGet);
  const siteOptions = useMemo(
    () => ((sitesResp?.data as any[]) || []).map((s: any) => ({ value: String(s.id), label: s.site })),
    [sitesResp?.data]
  );
  const itemOptions = useMemo(
    () =>
      ((itemsResp?.data as any[]) || []).map((it: any) => ({
        value: String(it.id),
        label: it.itemCode ? `${it.itemCode} - ${it.item}` : it.item,
      })),
    [itemsResp?.data]
  );
  const itemsById = useMemo(() => {
    const map = new Map<number, any>();
    ((itemsResp?.data as any[]) || []).forEach((it: any) => map.set(it.id, it));
    return map;
  }, [itemsResp?.data]);
  const itemsVal = form.watch("items");

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const hasDocFiles = documents.some((d) => d.documentUrl instanceof File);
      if (hasDocFiles) {
        const formDataPayload = new FormData();
        const payload = toSubmitPayload(data, documents);
        Object.entries(payload).forEach(([key, val]) => {
          if (key === "outwardDeliveryChallanDetails" || key === "outwardDeliveryChallanDocuments") return;
          if (val === undefined || val === null || val === "") return;
          if (val instanceof Date) formDataPayload.append(key, val.toISOString());
          else formDataPayload.append(key, String(val));
        });
        formDataPayload.append(
          "outwardDeliveryChallanDetails",
          JSON.stringify(payload.outwardDeliveryChallanDetails || [])
        );
        const docMetadata = documents.map((doc, index) => ({
          id: typeof doc.id === "number" && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || "",
          documentUrl: typeof doc.documentUrl === "string" ? doc.documentUrl : undefined,
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
        const response = await fetch("/api/outward-delivery-challans", { method: "POST", body: formDataPayload });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to save challan`);
        }
        await response.json();
      } else {
        const payload = toSubmitPayload(data, documents);
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
          <AppCard.Description>Add a new outward delivery challan.</AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend={<span className="text-base font-semibold">General</span>}>
              <FormRow cols={3} from="md">
                <TextInput control={control} name="outwardChallanDate" label="Outward Challan Date *" type="date" span={1} spanFrom="md" />
                <TextInput control={control} name="challanNo" label="Challan No *" placeholder="Enter challan no" span={1} spanFrom="md" />
                <TextInput control={control} name="challanDate" label="Challan Date *" type="date" span={1} spanFrom="md" />
              </FormRow>
              <FormRow cols={2} from="md">
                <ComboboxInput control={control} name="fromSiteId" label="From Site *" options={siteOptions} placeholder="Select site" required />
                <ComboboxInput control={control} name="toSiteId" label="To Site *" options={siteOptions} placeholder="Select site" required />
              </FormRow>
            </FormSection>

            <FormSection legend={<span className="text-base font-semibold">Outward Delivery Challan Details</span>}>
              <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-sm">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground">
                  <div className="col-span-1">Sr No</div>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-3">Challan Qty</div>
                  <div className="col-span-1"></div>
                </div>
                {fields.map((field, index) => {
                  const currentItemId = form.watch(`items.${index}.itemId` as const);
                  const selectedItem = currentItemId ? itemsById.get(parseInt(currentItemId)) : null;
                  const unitName = selectedItem?.unit?.unitName;
                  const usedIds = new Set<string>((itemsVal || []).map((v: any, i: number) => (i !== index ? (v?.itemId || "") : "")).filter((v: string) => !!v));
                  const rowItemOptions = itemOptions.filter((opt) => !usedIds.has(opt.value));
                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-3 items-center py-2 border-b">
                      <div className="col-span-1">{index + 1}</div>
                      <div className="col-span-5">
                        <ComboboxInput control={control} name={`items.${index}.itemId`} options={rowItemOptions} placeholder="Select item" />
                      </div>
                      <div className="col-span-2">{unitName || "—"}</div>
                      <div className="col-span-3">
                        <TextInput control={control} name={`items.${index}.challanQty`} label="" type="number" placeholder="0" span={12} />
                      </div>
                      <div className="col-span-1">
                        <button type="button" className="text-destructive inline-flex items-center text-sm" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {fields.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3">Add items to this challan.</div>
                )}
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center text-sm border rounded-md px-3 py-2"
                    onClick={() => append({ itemId: "", challanQty: "" })}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Add Item
                  </button>
                </div>
              </div>
            </FormSection>

            <FormSection legend={<span className="text-base font-semibold">Documents</span>}>
              <div className="space-y-4">
                {documents.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No documents added.</div>
                )}
                {documents.map((doc, index) => {
                  const inputId = `odc-doc-${index}`;
                  const isFileObject = doc.documentUrl && typeof doc.documentUrl !== "string" && (doc.documentUrl as File).name;
                  return (
                    <div key={(doc as any)._tempId ?? doc.id ?? index} className="rounded-2xl border p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-2 min-w-0">
                            <label className="text-sm font-semibold">Document Name<span className="text-red-500">*</span></label>
                            <input
                              className="mt-2 w-full rounded-lg border border-muted bg-background px-3 py-2 text-sm"
                              value={doc.documentName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDocuments((prev) => prev.map((d, i) => (i === index ? { ...d, documentName: v } : d)));
                              }}
                              placeholder="e.g. Invoice, LR, Ewaybill"
                            />
                          </div>
                        </div>
                        <button type="button" className="text-destructive inline-flex items-center text-sm" onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">File<span className="text-red-500">*</span></label>
                        <label htmlFor={inputId} className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{isFileObject ? (doc.documentUrl as File).name : "Click to select a file"}</p>
                              <p className="text-xs text-muted-foreground">JPG, PNG, PDF up to 20 MB.</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">Browse</span>
                        </label>
                        <input id={inputId} type="file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDocuments((prev) => prev.map((d, i) => (i === index ? { ...d, documentUrl: file } : d)));
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <button type="button" className="inline-flex items-center text-sm border rounded-md px-3 py-2" onClick={() => setDocuments((prev) => [...prev, { documentName: "", documentUrl: null, _tempId: -Date.now() }])}>
                    <Upload className="h-4 w-4 mr-2" /> Add Document
                  </button>
                </div>
              </div>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton type="button" variant="secondary" onClick={() => router.push(redirectOnSuccess)} disabled={submitting} iconName="X">Cancel</AppButton>
            <AppButton type="submit" iconName="Plus" isLoading={submitting} disabled={submitting || !form.formState.isValid}>Create Challan</AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
