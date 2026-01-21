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

export interface RoleFormInitialData {
  id?: number;
  name?: string;
  description?: string | null;
}

export interface RoleFormProps {
  mode: "create" | "edit";
  initial?: RoleFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function RoleForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/roles",
  mutate,
}: RoleFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("roles-list");

  const schema = z.object({
    name: z.string().min(1, "Role name is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initial?.name ?? "",
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === "create";

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let res;
      if (mode === "create") {
        res = await apiPost("/api/access-control/roles", {
          name: formData.name,
        });
        toast.success("Role created successfully");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        res = await apiPatch(`/api/access-control/roles/${initial.id}`, {
          name: formData.name,
        });
        toast.success("Role updated successfully");
        onSuccess?.(res);
      }

      if (mutate) await mutate();
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? "Create Role" : "Edit Role"}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add a new role." : "Update role information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Role Information">
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="name"
                  label="Role Name"
                  placeholder="Enter role name"
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
              {isCreate ? "Create Role" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default RoleForm;
