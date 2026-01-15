"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppSelect } from "@/components/common/app-select";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";

export interface BoqBillFormInitialData {
  id?: number;
  boqId?: number;
  billNumber?: string;
  billName?: string;
  billDate?: string;
  remarks?: string | null;
  details?: Array<{ id?: number; boqItemId: number; qty: number }>;
}

export interface BoqBillFormProps {
  mode: "create" | "edit";
  initial?: BoqBillFormInitialData | null;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

const schema = z.object({
  boqId: z.string().min(1, "BOQ is required"),
  billNumber: z.string().min(1, "Bill number is required"),
  billName: z.string().min(1, "Bill name is required"),
  billDate: z.string().min(1, "Bill date is required"),
  remarks: z.string().optional(),
  details: z
    .array(
      z.object({
        id: z.string().optional().default(""),
        boqItemId: z.string().min(1, "Item is required"),
        qty: z.string().optional().default(""),
      })
    )
    .default([]),
});

type FormValues = z.infer<typeof schema>;

export function BoqBillForm({
  mode,
  initial,
  redirectOnSuccess = "/boq-bills",
  mutate,
}: BoqBillFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      boqId: initial?.boqId ? String(initial.boqId) : "",
      billNumber: initial?.billNumber || "",
      billName: initial?.billName || "",
      billDate: initial?.billDate || "",
      remarks: initial?.remarks || "",
      details:
        (initial?.details || []).map((d) => ({
          id: d.id != null ? String(d.id) : "",
          boqItemId: String(d.boqItemId),
          qty: Number.isFinite(Number(d.qty)) ? Number(d.qty).toFixed(2) : "",
        })) || [],
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({
    control,
    name: "details",
  });

  const selectedBoqId = form.watch("boqId");

  const { data: boqsData } = useSWR<any>("/api/boqs?perPage=100", apiGet);
  const boqDetailUrl = useMemo(() => {
    if (!selectedBoqId) return null;
    return `/api/boqs/${selectedBoqId}`;
  }, [selectedBoqId]);

  const { data: boqDetail } = useSWR<any>(boqDetailUrl, apiGet);

  const boqItems: any[] = useMemo(
    () => (Array.isArray(boqDetail?.items) ? boqDetail.items : []),
    [boqDetail?.items]
  );

  const itemsById = useMemo(() => {
    const map = new Map<number, any>();
    boqItems.forEach((it) => map.set(Number(it.id), it));
    return map;
  }, [boqItems]);

  const detailsWatch = useWatch({ control, name: "details" });

  const computedRows = useMemo(() => {
    return (detailsWatch || []).map((d) => {
      const id = Number(d?.boqItemId);
      const item = itemsById.get(id);
      const rate = Number(item?.rate || 0);
      const boqQty = Number(item?.qty || 0);
      const boqAmount = Number(item?.amount || 0);
      const billedQty = Number(item?.billedQty || 0);
      const qty = Number(d?.qty || 0);
      const amount = Number((qty * rate).toFixed(2));
      return { boqItemId: id, qty, rate, amount, boqQty, boqAmount, billedQty, item };
    });
  }, [detailsWatch, itemsById]);

  const totalAmount = computedRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  useEffect(() => {
    const current = (form.getValues("details") || []) as FormValues["details"];

    if (!selectedBoqId) {
      if (current.length) replace([]);
      return;
    }

    if (!Array.isArray(boqItems) || boqItems.length === 0) return;
    const qtyByItemId = new Map<string, string>();
    const detailIdByItemId = new Map<string, string>();
    current.forEach((d) => {
      if (!d?.boqItemId) return;
      const key = String(d.boqItemId);
      qtyByItemId.set(key, (d.qty || "").toString());
      if (d.id) detailIdByItemId.set(key, String(d.id));
    });

    const next = boqItems.map((it: any) => {
      const key = String(it.id);
      const existingQty = qtyByItemId.get(key);
      const existingDetailId = detailIdByItemId.get(key);
      return {
        id: existingDetailId ?? "",
        boqItemId: key,
        qty: existingQty ?? "",
      };
    });

    const isSame =
      current.length === next.length &&
      current.every((d, i) =>
        d?.boqItemId === next[i]?.boqItemId &&
        String((d as any)?.id ?? "") === String((next[i] as any)?.id ?? "") &&
        String(d?.qty ?? "") === String(next[i]?.qty ?? "")
      );

    if (!isSame) {
      replace(next as any);
    }
  }, [selectedBoqId, boqItems, replace, form]);

  useEffect(() => {
    if (mode === "create") return;
  }, [mode]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const detailsForEdit = (values.details || []).map((d) => ({
        id: d.id ? Number(d.id) : undefined,
        boqItemId: parseInt(d.boqItemId),
        qty: Number(d.qty || 0),
      }));

      const payload = {
        boqId: parseInt(values.boqId),
        billNumber: values.billNumber.trim(),
        billName: values.billName.trim(),
        billDate: values.billDate,
        remarks: values.remarks ? values.remarks : null,
        details:
          mode === "create"
            ? detailsForEdit
                .filter((d) => Number(d.qty || 0) !== 0)
                .map((d) => ({ boqItemId: d.boqItemId, qty: d.qty }))
            : detailsForEdit,
      };

      if (mode === "create") {
        await apiPost("/api/boq-bills", payload);
        toast.success("BOQ bill created");
      } else if (mode === "edit" && initial?.id) {
        await apiPatch(`/api/boq-bills/${initial.id}`, payload);
        toast.success("BOQ bill updated");
      }

      if (mutate) await mutate();
      router.push(redirectOnSuccess);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save BOQ bill");
    } finally {
      setSubmitting(false);
    }
  }

  const boqOptions = (boqsData?.data || []).map((b: any) => {
    const boqNo = b?.boqNo || `BOQ #${b?.id}`;
    const siteName = b?.site?.site ? String(b.site.site) : "";
    return {
      value: String(b.id),
      label: siteName ? `${boqNo} - ${siteName}` : boqNo,
    };
  });

  function isValidQtyInput(v: string) {
    if (v === "") return true;
    return /^\d*(\.\d{0,4})?$/.test(v);
  }

  function setQtyAtIndex(idx: number, next: string) {
    if (!isValidQtyInput(next)) return;
    form.setValue(`details.${idx}.qty` as any, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function formatQtyInput(v: string) {
    if (!v) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  return (
    <Form {...form}>
      <AppCard className="w-auto mx-auto">
        <AppCard.Header>
          <AppCard.Title>{mode === "create" ? "Create BOQ Bill" : "Edit BOQ Bill"}</AppCard.Title>
          <AppCard.Description>
            {mode === "create" ? "Add a new BOQ bill." : "Update BOQ bill."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Bill Information">
              <FormRow cols={3} from="md">
                <div className="space-y-2">
                  <label className="text-sm">BOQ</label>
                  <AppSelect
                    value={selectedBoqId}
                    onValueChange={(v) => {
                      form.setValue("boqId", v, { shouldValidate: true, shouldDirty: true });
                      replace([]);
                    }}
                    placeholder="Select BOQ"
                  >
                    {boqOptions.map((opt: any) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <div><TextInput control={control} placeholder="Bill Number" name="billNumber" label="Bill No." required /></div>
                <div> <TextInput control={control} placeholder="Bill Date" name="billDate" label="Bill Date" type="date" required /></div>
               
              </FormRow>
              <FormRow cols={1} from="md">
                <TextInput control={control} placeholder="Bill Name" name="billName" label="Bill Name" required />
              </FormRow>
              <FormRow cols={1} from="md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Remarks</label>
                  <Textarea
                    value={form.watch("remarks") || ""}
                    onChange={(e) =>
                      form.setValue("remarks", e.target.value, { shouldValidate: true, shouldDirty: true })
                    }
                  />
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Bill Items">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">Total Amount: {totalAmount.toFixed(2)}</div>
                </div>

                {selectedBoqId && boqItems.length > 0 ? (
                  <div className="overflow-x-auto border rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Description of item</th>
                          <th className="text-left font-medium px-3 py-2">Unit</th>
                          <th className="text-right font-medium px-3 py-2">BOQ Qty</th>
                          <th className="text-right font-medium px-3 py-2">
                            {mode === "edit" ? "Billed Qty (including this record)" : "Billed Qty"}
                          </th>
                          <th className="text-right font-medium px-3 py-2">Rate</th>
                          <th className="text-right font-medium px-3 py-2">BOQ AMOUNT</th>
                          <th className="text-right font-medium px-3 py-2">Qty</th>
                          <th className="text-right font-medium px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(computedRows || []).map((row, idx) => {
                          const desc = `${row?.item?.item || ""}`;
                          const unitName = row?.item?.unit?.unitName || "—";
                          const isGroup = Boolean(row?.item?.isGroup);
                          const qtyValue = ((detailsWatch?.[idx] as any)?.qty ?? "").toString();
                          return (
                            <tr key={row.boqItemId} className="border-t">
                              <td className="px-3 py-2 align-top">
                                <div className={isGroup ? "font-medium" : ""}>{desc || "—"}</div>
                                {row?.item?.clientSrNo ? (
                                  <div className="text-xs text-muted-foreground">Client Sr No: {row.item.clientSrNo}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 align-top">{unitName}</td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {Number(row?.boqQty || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {Number((row as any)?.billedQty || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {Number(row?.rate || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {Number(row?.boqAmount || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                <input
                                  type="text"
                                  className="h-9 w-28 border rounded-md px-2 text-right"
                                  value={qtyValue}
                                  onChange={(e) => setQtyAtIndex(idx, e.target.value)}
                                  onBlur={(e) => setQtyAtIndex(idx, formatQtyInput(e.target.value))}
                                  disabled={isGroup}
                                />
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {Number(row?.amount || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {selectedBoqId ? "No BOQ items found." : "Select a BOQ to view items."}
                  </div>
                )}
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
              iconName={mode === "create" ? "Plus" : "Save"}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {mode === "create" ? "Create Bill" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
