"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { CreateCityData, UpdateCityData } from "@/types/cities";
import { State } from "@/types/states";
import { AppSelect } from "@/components/common/app-select";
import { apiGet } from "@/lib/api-client";
import useSWR from "swr";

export interface CityFormInitialData {
  id?: number;
  city?: string;
  stateId: number; // Changed from optional to required
}

export interface CityFormProps {
  mode: "create" | "edit";
  initial?: CityFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>; // Add this line
}

export function CityForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/cities",
  mutate,
}: CityFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("cities-list");

  const schema = z.object({
    city: z.string().min(1, "City name is required"),
    stateId: z
      .number({
        required_error: "State is required",
        invalid_type_error: "Please select a state",
      })
      .min(1, "State is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      city: initial?.city ?? "",
      stateId: initial?.stateId, // Remove null fallback since it's required
    },
  });

  const { control, handleSubmit } = form;
  const stateIdValue = form.watch("stateId");
  const isCreate = mode === "create";

  // Fetch states for dropdown
  const { data: statesData } = useSWR<{ data: State[] }>(
    "/api/states?perPage=100",
    apiGet
  );

  const onSubmit = async (formData: FormValues) => {
    setSubmitting(true);
    try {
      let res;
      if (mode === "create") {
        const payload: CreateCityData = {
          city: formData.city,
          stateId: formData.stateId,
        };
        res = await apiPost("/api/cities", payload);
        toast.success("City created successfully");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const payload: UpdateCityData = {
          city: formData.city,
          stateId: formData.stateId,
        };
        res = await apiPatch(`/api/cities/${initial.id}`, payload);
        toast.success("City updated successfully");
        onSuccess?.(res);
      }

      // Invalidate and revalidate the cache
      if (mutate) {
        await mutate();
      }

      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save city");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create City" : "Edit City"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new city to the master data."
              : "Update city information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="City Information">
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="city"
                  label="City Name"
                  placeholder="Enter city name"
                  required
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <AppSelect
                    value={stateIdValue ? String(stateIdValue) : "__none"}
                    onValueChange={(value) => {
                      const numValue = parseInt(value);
                      form.setValue("stateId", numValue, {
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Select state"
                  >
                    <AppSelect.Item value="__none">No State</AppSelect.Item>
                    {statesData?.data?.map((state: State) => (
                      <AppSelect.Item key={state.id} value={String(state.id)}>
                        {state.state}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={backWithScrollRestore}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName={isCreate ? "Plus" : "Save"}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {isCreate ? "Create City" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default CityForm;
