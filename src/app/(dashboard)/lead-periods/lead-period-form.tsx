"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppButton } from "@/components/common/app-button";
import { AppCard } from "@/components/common/app-card";
import { AppCombobox } from "@/components/common/app-combobox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

const leadPeriodSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  items: z.array(
    z.object({
      itemId: z.string().min(1, "Item is required"),
      period: z.coerce.number().min(1, "Period must be at least 1"),
    })
  ).min(1, "At least one item is required"),
});

type LeadPeriodFormValues = z.infer<typeof leadPeriodSchema>;

interface LeadPeriodFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function LeadPeriodForm({ initialData, isEdit }: LeadPeriodFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<LeadPeriodFormValues>({
    resolver: zodResolver(leadPeriodSchema),
    defaultValues: {
      siteId: initialData?.siteId?.toString() || "",
      items: initialData?.leadPeriodDetails 
        ? initialData.leadPeriodDetails.map((d: any) => ({
            itemId: d.itemId.toString(),
            period: d.period || 1
          }))
        : [{ itemId: "", period: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { data: sitesData } = useSWR<{ data: any[] }>("/api/sites?perPage=1000", apiGet);
  const { data: itemsData } = useSWR<{ data: any[] }>("/api/items?perPage=1000", apiGet);

  const sitesOptions = (sitesData?.data || []).map(s => ({ value: s.id.toString(), label: s.site }));
  const itemsOptions = (itemsData?.data || []).map(i => ({ 
    value: i.id.toString(), 
    label: `${i.item} (${i.itemCode})` 
  }));

  const { data: lpData, isLoading: isLpLoading } = useSWR<any>(
    isEdit && initialData?.id ? `/api/lead-periods/${initialData.id}` : null,
    apiGet
  );

  useEffect(() => {
    if (lpData) {
      const lp = lpData;
      form.reset({
        siteId: String(lp.siteId),
        items: lp.leadPeriodDetails.map((d: any) => ({
          itemId: String(d.itemId),
          period: d.period,
        })),
      });
    }
  }, [lpData, form]);

  async function onSubmit(values: LeadPeriodFormValues) {
    try {
      setIsSubmitting(true);
      const payload = {
        siteId: Number(values.siteId),
        items: values.items.map(i => ({
          itemId: Number(i.itemId),
          period: Number(i.period)
        }))
      };

      if (isEdit && initialData?.id) {
        await apiPatch(`/api/lead-periods/${initialData.id}`, payload);
        toast.success("Lead periods updated");
      } else {
        await apiPost("/api/lead-periods", payload);
        toast.success("Lead periods saved");
      }
      router.push("/lead-periods");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEdit && isLpLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-muted-foreground">Loading lead period data...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <div className="flex items-center gap-4">
          <AppButton
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </AppButton>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Edit Lead Period" : "Add Lead Periods"}
          </h1>
        </div>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Basic Information</AppCard.Title>
            <AppCard.Description>Select the site for lead periods.</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <FormField
              control={form.control}
              name="siteId"
              render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormLabel>Site *</FormLabel>
                  <FormControl>
                    <AppCombobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={sitesOptions}
                      placeholder="Select site"
                      searchPlaceholder="Search site..."
                      disabled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <AppCard.Title>Items & Periods</AppCard.Title>
              <AppCard.Description>Define lead periods for each item.</AppCard.Description>
            </div>
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemId: "", period: 1 })}
              className="h-8 py-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </AppButton>
          </AppCard.Header>
          <AppCard.Content>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-sm w-[60%]">Item *</th>
                    <th className="text-left p-2 font-medium text-sm w-[30%]">Lead Period (Days) *</th>
                    <th className="text-center p-2 font-medium text-sm w-[10%]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id} className="border-t">
                      <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.itemId`}
                          render={({ field: itemField }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <AppCombobox
                                  value={itemField.value}
                                  onValueChange={itemField.onChange}
                                  options={itemsOptions}
                                  placeholder="Select item"
                                  searchPlaceholder="Search item..."
                                  disabled={false}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.period`}
                          render={({ field: periodField }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Days"
                                  {...periodField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      <td className="p-2 text-center text-sm font-medium">
                        <AppButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </AppButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {form.formState.errors.items?.root && (
              <p className="text-sm font-medium text-destructive mt-2">
                {form.formState.errors.items.root.message}
              </p>
            )}
          </AppCard.Content>
          <AppCard.Footer className="flex justify-end gap-3">
            <AppButton
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="text-black dark:text-white"
            >
              Cancel
            </AppButton>
            <AppButton type="submit" isLoading={isSubmitting}>
              {isEdit ? "Update Lead Period" : "Save Lead Periods"}
            </AppButton>
          </AppCard.Footer>
        </AppCard>
      </form>
    </Form>
  );
}
