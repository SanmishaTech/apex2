"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common";
import { Form, FormLabel } from "@/components/ui/form";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppSelect } from "@/components/common/app-select";
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";

function utcToISTTime(utc: string | null) {
  if (!utc) return "";
  const date = new Date(utc);
  // Convert to IST (UTC + 5:30)
  const istTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  // Return HH:MM
  return istTime.toISOString().split("T")[1].slice(0, 5);
}

export interface DailyProgressDetail {
  boqItemId?: number | null;
  clientSerialNo?: string | null;
  activityId?: string | null;
  item?: string | null;
  unit?: string | null;
  boqQty?: string | number | null;
  doneQty?: string | number | null;
  particulars?: string | null;
  amount?: string | number | null;
}

export interface DailyProgressHindrance {
  from?: string | null;
  to?: string | null;
  hrs?: string | number | null;
  location?: string | null;
  reason?: string | null;
}

export interface DailyProgressFormInitialData {
  id?: number;
  siteId?: number | null;
  boqId?: number | null;
  progressDate?: string | null;

  /** ✅ Added missing fields that backend returns */
  dailyProgressDetails?: DailyProgressDetail[] | null;
  dailyProgressHindrances?: DailyProgressHindrance[] | null;

  /** keep for compatibility */
  details?: DailyProgressDetail[] | null;
  hindrances?: DailyProgressHindrance[] | null;
}

export interface DailyProgressFormProps {
  mode: "create" | "edit";
  initial?: DailyProgressFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  boqId: z.string().min(1, "BOQ is required"),
  progressDate: z.string().min(1, "Progress date is required"),
  details: z
    .array(
      z.object({
        boqItemId: z.string().optional(),
        clientSerialNo: z.string().optional(),
        activityId: z.string().optional(),
        item: z.string().optional(),
        unit: z.string().optional(),
        boqQty: z.string().optional(),
        doneQty: z.string().optional(),
        particulars: z.string().optional(),
        amount: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  hindrances: z
    .array(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        hrs: z.string().optional(),
        location: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

type RawFormValues = z.infer<typeof inputSchema>;

function toSubmitPayload(data: RawFormValues) {
  const today = new Date().toISOString().split("T")[0];
  return {
    siteId: data.siteId ? parseInt(data.siteId) : null,
    boqId: data.boqId ? parseInt(data.boqId) : null,
    progressDate: data.progressDate
      ? new Date(data.progressDate).toISOString()
      : null,
    details: (data.details || []).map((d) => ({
      boqItemId: d.boqItemId ? parseInt(d.boqItemId) : null,
      clientSerialNo: d.clientSerialNo || null,
      activityId: d.activityId || null,
      item: d.item || null,
      unit: d.unit || null,
      boqQty: d.boqQty && d.boqQty !== "" ? d.boqQty : 0,
      doneQty: d.doneQty && d.doneQty !== "" ? d.doneQty : 0,
      particulars: d.particulars || null,
      amount: d.amount && d.amount !== "" ? d.amount : 0,
    })),
    hindrances: (data.hindrances || []).map((h) => ({
      from: h.from ? new Date(`${today}T${h.from}`).toISOString() : null,
      to: h.to ? new Date(`${today}T${h.to}`).toISOString() : null,
      hrs: h.hrs && h.hrs !== "" ? parseInt(h.hrs) : null,
      location: h.location || null,
      reason: h.reason || null,
    })),
  };
}

export function DailyProgressForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/daily-progresses",
}: DailyProgressFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [filteredBoqs, setFilteredBoqs] = useState<any[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);

  const isCreate = mode === "create";

  const { data: sitesData } = useSWR<any>("/api/sites?perPage=100", apiGet);
  const { data: boqsData } = useSWR<any>("/api/boqs?perPage=100", apiGet);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : "",
      boqId: initial?.boqId ? String(initial.boqId) : "",
      progressDate: initial?.progressDate
        ? initial.progressDate.split("T")[0]
        : "",
      details:
        initial?.dailyProgressDetails?.map((d) => ({
          boqItemId: d.boqItemId ? String(d.boqItemId) : "",
          clientSerialNo: d.clientSerialNo || "",
          activityId: d.activityId || null,
          item: d.item || "",
          unit: d.unit || "",
          boqQty: d.boqQty ? String(d.boqQty) : "",
          doneQty: d.doneQty ? String(d.doneQty) : "",
          particulars: d.particulars || "",
          amount: d.amount ? String(d.amount) : "",
        })) || [],
      hindrances:
        initial?.dailyProgressHindrances?.map((h) => ({
          from: utcToISTTime(h.from),
          to: utcToISTTime(h.to),
          hrs: h.hrs ? String(h.hrs) : "",
          location: h.location || "",
          reason: h.reason || "",
        })) || [],
    },
  });

  const { control, handleSubmit, watch, setValue, getValues } = form;

  const details = useWatch({ control, name: "details" });

  useEffect(() => {
    details.forEach((detail, index) => {
      const boqItemId = detail?.boqItemId;
      if (!boqItemId) return;

      const selected = boqItems.find((it) => String(it.id) === boqItemId);
      if (!selected) return;

      // Only update if not already set (prevents infinite loop)
      if (
        detail.clientSerialNo !== selected.clientSrNo ||
        detail.activityId !== selected.activityId ||
        detail.item !== selected.item ||
        detail.unit !== selected.unit ||
        detail.boqQty !== selected.boqQty ||
        detail.amount !== selected.boqQty
      ) {
        setValue(`details.${index}.clientSerialNo`, selected.clientSrNo);
        setValue(`details.${index}.activityId`, selected.activityId);
        setValue(`details.${index}.item`, selected.item);
        setValue(`details.${index}.unit`, selected.unit);
        setValue(`details.${index}.boqQty`, selected.boqQty);
        setValue(`details.${index}.amount`, selected.amount);
      }
    });
  }, [details, boqItems, setValue]);

  // useEffect(() => {
  //   console.log("🟡 Details changed:", details);
  // }, [details]);
  const siteId = watch("siteId");
  const boqId = watch("boqId");

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({ control, name: "details" });
  const {
    fields: hindranceFields,
    append: appendHindrance,
    remove: removeHindrance,
  } = useFieldArray({ control, name: "hindrances" });

  useEffect(() => {
    if (!boqsData?.data) return;
    if (!siteId) setFilteredBoqs(boqsData.data);
    else
      setFilteredBoqs(boqsData.data.filter((b: any) => b.siteId === +siteId));
  }, [boqsData, siteId]);

  useEffect(() => {
    if (!boqId) {
      setBoqItems([]);
      return;
    }
    (async () => {
      const res: unknown = await apiGet(`/api/boqs/${boqId}`);
      /** ✅ Safe guard for unknown type */
      if (res && typeof res === "object" && Array.isArray((res as any).items)) {
        const mapped = (res as any).items.map((it: any) => ({
          id: it.id,
          activityId: it.activityId || null,
          clientSrNo: it.clientSrNo || "-",
          item: it.item || "-",
          unit: it.unit || "-",
          boqQty: it.qty || "0",
          amount: it.qty || "0",
        }));
        setBoqItems(mapped);
      } else setBoqItems([]);
    })();
  }, [boqId]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost("/api/daily-progresses", payload);
        toast.success("Daily Progress created");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const res = await apiPatch("/api/daily-progresses", {
          id: initial.id,
          ...payload,
        });
        toast.success("Daily Progress updated");
        onSuccess?.(res);
      }
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
          <AppCard.Title>
            {isCreate ? "Create Daily Progress" : "Edit Daily Progress"}
          </AppCard.Title>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            {/* ===== General Section ===== */}
            <FormSection
              legend={<span className="text-base font-semibold">General</span>}
            >
              <FormRow cols={3} from="md">
                <AppSelect
                  control={control}
                  name="siteId"
                  label="Site *"
                  placeholder="Select site"
                  triggerClassName="h-9 w-full"
                >
                  {sitesData?.data?.map((s: any) => (
                    <AppSelect.Item key={s.id} value={String(s.id)}>
                      {s.site}
                    </AppSelect.Item>
                  ))}
                </AppSelect>

                <AppSelect
                  control={control}
                  name="boqId"
                  label="BOQ *"
                  placeholder="Select BOQ"
                  triggerClassName="h-9 w-full"
                  disabled={!siteId}
                >
                  {filteredBoqs.map((b: any) => (
                    <AppSelect.Item key={b.id} value={String(b.id)}>
                      {b.boqNo || b.workName}
                    </AppSelect.Item>
                  ))}
                </AppSelect>
                <div>
                  <TextInput
                    control={control}
                    name="progressDate"
                    label="Progress Date *"
                    type="date"
                  />
                </div>
              </FormRow>
            </FormSection>

            {/* ===== Progress Details Section ===== */}
            <FormSection
              legend={
                <span className="text-base font-semibold">
                  Progress Details
                </span>
              }
            >
              <div className="flex flex-col gap-4">
                {detailFields.map((field, index) => {
                  const detail = getValues(`details.${index}`);

                  return (
                    <div
                      key={field.id}
                      className="border rounded-md p-4 bg-card"
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <AppSelect
                          control={control}
                          name={`details.${index}.boqItemId`}
                          label="Activity ID"
                          placeholder="Select Activity"
                          className="col-span-12 md:col-span-2"
                          onValueChange={(value) => {
                            setValue(`details.${index}.boqItemId`, value, {
                              shouldValidate: true,
                            });

                            const selected = boqItems.find(
                              (it) => String(it.id) === value
                            );
                            if (selected) {
                              setValue(
                                `details.${index}.clientSerialNo`,
                                selected.clientSrNo
                              );
                              setValue(
                                `details.${index}.activityId`,
                                selected.activityId
                              );
                              setValue(`details.${index}.item`, selected.item);
                              setValue(`details.${index}.unit`, selected.unit);
                              setValue(`details.${index}.boqQty`, selected.qty);
                              setValue(
                                `details.${index}.doneQty`,
                                selected.qty
                              );
                              setValue(`details.${index}.amount`, selected.qty);
                            }
                          }}
                        >
                          {boqItems.length === 0
                            ? ""
                            : boqItems.map((it) => (
                                <AppSelect.Item
                                  key={it.id}
                                  value={String(it.id)}
                                >
                                  {it.activityId ??
                                    it.item ??
                                    "Unnamed Activity"}
                                </AppSelect.Item>
                              ))}
                        </AppSelect>

                        <div className="col-span-12 md:col-span-4">
                          <FormLabel>Client Sr No</FormLabel>
                          <div className="border mt-2 px-2 py-1 rounded bg-muted">
                            {detail.clientSerialNo || "-"}
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <FormLabel>Unit</FormLabel>
                          <div className="border mt-2 px-2 py-1 rounded bg-muted">
                            {detail.unit || "-"}
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <FormLabel>BOQ Qty</FormLabel>
                          <div className="border mt-2 px-2 py-1 rounded bg-muted">
                            {detail.boqQty || "-"}
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-12">
                          <FormLabel>Item</FormLabel>
                          <div className="border mt-2 px-2 py-1 rounded bg-muted">
                            {detail.item || "-"}
                          </div>
                        </div>

                        <div className="col-span-12 md:col-span-2">
                          <TextInput
                            control={control}
                            name={`details.${index}.doneQty`}
                            label="Done Today"
                            type="number"
                            className="col-span-12 md:col-span-2"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-10">
                          <TextInput
                            control={control}
                            name={`details.${index}.particulars`}
                            label="Particulars"
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <AppButton
                          type="button"
                          variant="destructive"
                          size="sm"
                          iconName="Trash"
                          onClick={() => removeDetail(index)}
                        >
                          Remove
                        </AppButton>
                      </div>
                    </div>
                  );
                })}
                <div>
                  <AppButton
                    type="button"
                    size="sm"
                    iconName="Plus"
                    onClick={() =>
                      appendDetail({
                        boqItemId: "",
                        clientSerialNo: "",
                        activityId: null,
                        item: "",
                        unit: "",
                        boqQty: "",
                        doneQty: "",
                        particulars: "",
                        amount: "",
                      })
                    }
                  >
                    Add Detail
                  </AppButton>
                </div>
              </div>
            </FormSection>

            {/* ===== Hindrances Section ===== */}
            <FormSection
              legend={
                <span className="text-base font-semibold">Hindrances</span>
              }
            >
              <div className="flex flex-col gap-4">
                {hindranceFields.map((field, index) => (
                  <div key={field.id} className="border rounded-md p-4 bg-card">
                    <div className="grid grid-cols-12  gap-3">
                      <div className="col-span-12 md:col-span-3">
                        <TextInput
                          control={control}
                          name={`hindrances.${index}.from`}
                          label="From"
                          type="time"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <TextInput
                          control={control}
                          name={`hindrances.${index}.to`}
                          label="To"
                          type="time"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <TextInput
                          control={control}
                          name={`hindrances.${index}.hrs`}
                          label="Hours"
                          type="number"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <TextInput
                          control={control}
                          name={`hindrances.${index}.location`}
                          label="Location"
                        />
                      </div>
                      <div className="col-span-12">
                        <TextInput
                          control={control}
                          name={`hindrances.${index}.reason`}
                          label="Reason"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <AppButton
                        type="button"
                        variant="destructive"
                        size="sm"
                        iconName="Trash"
                        onClick={() => removeHindrance(index)}
                      >
                        Remove
                      </AppButton>
                    </div>
                  </div>
                ))}
                <div>
                  <AppButton
                    type="button"
                    size="sm"
                    iconName="Plus"
                    onClick={() =>
                      appendHindrance({
                        from: "",
                        to: "",
                        hrs: "",
                        location: "",
                        reason: "",
                      })
                    }
                  >
                    Add Hindrance
                  </AppButton>
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
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName={isCreate ? "Plus" : "Save"}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {isCreate ? "Create Daily Progress" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default DailyProgressForm;
