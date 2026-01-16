"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { formatDateForInput } from "@/lib/locales";
import { Plus, Trash2 } from "lucide-react";
import type { SitesResponse } from "@/types/sites";
import type { ItemsResponse } from "@/types/items";
import type { CreateIndentRequest, IndentItem } from "@/types/indents";

export interface IndentFormInitialData {
  id?: number;
  indentNo?: string;
  indentDate?: string;
  deliveryDate?: string;
  siteId?: number | null;
  remarks?: string | null;
  indentItems?: IndentItem[];
}

export interface IndentFormProps {
  mode: "create" | "edit";
  initial?: IndentFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/indents'
}

const indentItemSchema = z.object({
  itemId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Item is required"
    )
    .transform((val) => parseInt(val)),
  remark: z.string().optional(),
  indentQty: z.preprocess(
    (v) => (v === null || typeof v === "undefined" ? "" : String(v).trim()),
    z
      .string()
      .min(1, "Indent quantity is required")
      .regex(/^\d+(\.\d{1,4})?$/, "Only numbers up to 4 decimal places are allowed")
      .transform((val) => Number(val))
      .refine((n) => typeof n === "number" && !Number.isNaN(n) && n > 0, {
        message: "Indent quantity must be greater than 0",
      })
  ),
});

const createInputSchema = z.object({
  indentDate: z.string().min(1, "Indent date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  siteId: z.preprocess(
    (v) => (v === null || typeof v === "undefined" ? "" : String(v).trim()),
    z
      .string()
      .refine((v) => v !== "__none" && v !== "" && v !== "0", {
        message: "Site is required",
      })
      .transform((v) => parseInt(v, 10))
      .refine((v) => typeof v === "number" && !Number.isNaN(v), {
        message: "Site is required",
      })
  ),
  remarks: z.string().optional(),
  indentItems: z
    .array(indentItemSchema)
    .min(1, "At least one item is required"),
});

// Use the raw input type before Zod transformation for the form
type FormData = {
  indentDate: string;
  deliveryDate: string;
  siteId?: string | number;
  remarks?: string;
  indentItems: {
    itemId: string | number;
    remark?: string;
    indentQty: string | number; // HTML number inputs return strings
  }[];
};

export function IndentForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/indents",
}: IndentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema) as any, // Type assertion to handle the generic type issue
    defaultValues: {
      indentDate: initial?.indentDate
        ? formatDateForInput(initial.indentDate)
        : formatDateForInput(new Date().toISOString()),
      deliveryDate: initial?.deliveryDate
        ? formatDateForInput(initial.deliveryDate)
        : formatDateForInput(new Date().toISOString()),
      siteId: initial?.siteId ? String(initial.siteId) : "__none",
      remarks: initial?.remarks || "",
      indentItems: initial?.indentItems?.map((item) => ({
        itemId: item.itemId
          ? String(item.itemId)
          : item.item?.id
          ? String(item.item.id)
          : "__none",
        remark: item.remark || "",
        indentQty: item.indentQty,
      })) || [
        {
          itemId: "__none",
          remark: "",
          indentQty: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray<FormData>({
    control: form.control,
    name: "indentItems",
  });

  // Fetch sites, items, and units for dropdowns
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );
  const { data: itemsData } = useSWR<ItemsResponse>(
    "/api/items?perPage=100",
    apiGet
  );

  // Reset form values when initial data changes
  useEffect(() => {
    if (initial && mode === "edit") {
      form.reset({
        indentDate: initial.indentDate
          ? formatDateForInput(initial.indentDate)
          : formatDateForInput(new Date().toISOString()),
        deliveryDate: initial.deliveryDate
          ? formatDateForInput(initial.deliveryDate)
          : formatDateForInput(new Date().toISOString()),
        siteId: initial.siteId ? String(initial.siteId) : "__none",
        remarks: initial.remarks || "",
        indentItems: initial.indentItems?.map((item) => ({
          itemId: item.itemId
            ? String(item.itemId)
            : item.item?.id
            ? String(item.item.id)
            : "__none",
          remark: item.remark || "",
          indentQty: item.indentQty,
        })) || [
          {
            itemId: "__none",
            remark: "",
            indentQty: 0,
          },
        ],
      });
    }
  }, [initial, mode, form]);

  const addItem = () => {
    append({
      itemId: "__none",
      remark: "",
      indentQty: "",
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      // Validate and transform using Zod schema

      const transformedData = createInputSchema.parse(values);

      // Ensure dates are in YYYY-MM-DD format for the API
      const formatDateForApi = (dateString: string) => {
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
      };

      const payload: CreateIndentRequest = {
        indentDate: formatDateForApi(transformedData.indentDate),
        deliveryDate: formatDateForApi(transformedData.deliveryDate),
        siteId: transformedData.siteId,
        remarks: transformedData.remarks || undefined,
        indentItems: transformedData.indentItems.map((item) => ({
          itemId: item.itemId,
          remark: item.remark || undefined,
          indentQty: item.indentQty,
        })),
      };

      let result;
      if (mode === "create") {
        result = await apiPost("/api/indents", payload);
        toast.success("Indent created successfully");
      } else {
        result = await apiPatch(`/api/indents/${initial?.id}`, payload);
        toast.success("Indent updated successfully");
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode} indent`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Since DataTable doesn't support form inputs directly, we'll use a simpler table approach
  const renderItemsTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-4 font-medium">Item *</th>
            <th className="text-left p-4 font-medium">Remark</th>
            <th className="text-left p-4 font-medium">Indent Qty *</th>
            <th className="text-center p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id} className="border-t">
              <td className="p-4">
                <FormField
                  control={form.control}
                  name={`indentItems.${index}.itemId`}
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormControl>
                        <AppSelect
                          value={String(field.value || "__none")}
                          onValueChange={field.onChange}
                        >
                          <AppSelect.Item value="__none">
                            Select Item
                          </AppSelect.Item>
                          {itemsData?.data
                            ?.filter(
                              (item) => item.id && item.item && item.itemCode
                            )
                            .map((item) => (
                              <AppSelect.Item
                                key={item.id}
                                value={item.id.toString()}
                              >
                                {item.item} ({item.itemCode})
                              </AppSelect.Item>
                            ))}
                        </AppSelect>
                      </FormControl>
                      <div className="min-h-[20px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>

              <td className="p-4">
                <FormField
                  control={form.control}
                  name={`indentItems.${index}.remark`}
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormControl>
                        <Input {...field} placeholder="Remark" />
                      </FormControl>
                      <div className="min-h-[20px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-4">
                <FormField
                  control={form.control}
                  name={`indentItems.${index}.indentQty`}
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.0000"
                          onChange={(e) => {
                            const next = e.target.value;
                            // Allow intermediate typing states; final validation happens in Zod on submit
                            if (/^\d*(\.\d{0,4})?$/.test(next)) {
                              field.onChange(next);
                            }
                          }}
                        />
                      </FormControl>
                      <div className="min-h-[20px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-4 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={fields.length <= 1}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          {mode === "create" ? "Add Indent" : "Edit Indent"}
          {initial?.indentNo && ` - ${initial.indentNo}`}
        </AppCard.Title>
        <AppCard.Description>
          {mode === "create"
            ? "Create a new indent for material requisition."
            : "Update indent details and items."}
        </AppCard.Description>
      </AppCard.Header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="indentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indent Date *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem className="pt-6">
                    <FormLabel>Site<span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <AppSelect
                        value={String(field.value || "__none")}
                        onValueChange={field.onChange}
                      >
                        <AppSelect.Item value="__none">
                          Select Site
                        </AppSelect.Item>
                        {sitesData?.data
                          ?.filter((site) => site.id && site.site)
                          .map((site) => (
                            <AppSelect.Item
                              key={site.id}
                              value={site.id.toString()}
                            >
                              {site.site}
                            </AppSelect.Item>
                          ))}
                      </AppSelect>
                    </FormControl>
                    <div className="min-h-[20px]">
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter general remarks"
                        rows={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Indent Items Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium">Indent Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Add items to this indent
                  </p>
                </div>
              </div>

              {renderItemsTable()}

              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addItem}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </AppCard.Content>

          <AppCard.Footer className="flex justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push(redirectOnSuccess)}
              disabled={isSubmitting}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" isLoading={isSubmitting}>
              {mode === "create" ? "Create Indent" : "Update Indent"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </Form>
    </AppCard>
  );
}
