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
import type { DesignationsResponse } from "@/types/designations";

export interface DesignationFormInitialData {
  id?: number;
  designationName?: string;
}

export interface DesignationFormProps {
  mode: "create" | "edit";
  initial?: DesignationFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function DesignationForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/designations",
  mutate,
}: DesignationFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("designations-list");

  const schema = z.object({
    designationName: z.string().min(1, "Designation name is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      designationName: initial?.designationName ?? "",
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === "create";

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let res;
      if (mode === "create") {
        res = await apiPost("/api/designations", {
          designationName: formData.designationName,
        });
        toast.success("Designation created successfully");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        res = await apiPatch(`/api/designations/${initial.id}`, {
          designationName: formData.designationName,
        });
        toast.success("Designation updated successfully");
        onSuccess?.(res);
      }

      if (mutate) await mutate();
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save designation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Designation" : "Edit Designation"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new designation to the master data."
              : "Update designation information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Designation Information">
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="designationName"
                  label="Designation Name"
                  placeholder="Enter designation name"
                  required
                />
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
              {isCreate ? "Create Designation" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default DesignationForm;
