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

export interface ZoneFormInitialData {
  id?: number;
  zoneName?: string;
}

export interface ZoneFormProps {
  mode: "create" | "edit";
  initial?: ZoneFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function ZoneForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/zones",
  mutate,
}: ZoneFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("zones-list");

  const schema = z.object({
    zoneName: z.string().min(1, "Zone name is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      zoneName: initial?.zoneName ?? "",
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === "create";

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let res;
      if (mode === "create") {
        res = await apiPost("/api/zones", {
          zoneName: formData.zoneName,
        });
        toast.success("Zone created successfully");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        res = await apiPatch(`/api/zones/${initial.id}`, {
          zoneName: formData.zoneName,
        });
        toast.success("Zone updated successfully");
        onSuccess?.(res);
      }

      if (mutate) await mutate();
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save zone");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? "Create Zone" : "Edit Zone"}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add a new zone to the master data." : "Update zone information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Zone Information">
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="zoneName"
                  label="Zone Name"
                  placeholder="Enter zone name"
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
              {isCreate ? "Create Zone" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default ZoneForm;
