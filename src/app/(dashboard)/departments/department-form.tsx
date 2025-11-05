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
import {
  CreateDepartmentData,
  UpdateDepartmentData,
} from "@/types/departments";

export interface DepartmentFormInitialData {
  id?: number;
  department?: string;
}

export interface DepartmentFormProps {
  mode: "create" | "edit";
  initial?: DepartmentFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function DepartmentForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/departments",
  mutate,
}: DepartmentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("departments-list");

  const schema = z.object({
    department: z.string().min(1, "Department is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      department: initial?.department ?? "",
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === "create";

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let result;
      if (mode === "create") {
        const payload: CreateDepartmentData = {
          department: formData.department,
        };
        result = await apiPost("/api/departments", payload);
        toast.success("Department created successfully");
      } else if (mode === "edit" && initial?.id) {
        const payload: UpdateDepartmentData = {
          department: formData.department,
        };
        result = await apiPatch(`/api/departments/${initial.id}`, payload);
        toast.success("Department updated successfully");
      }

      // Invalidate and revalidate the cache
      if (mutate) {
        await mutate();
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Department" : "Edit Department"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new department to the master data."
              : "Update department information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Department Information">
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="department"
                  label="Department"
                  placeholder="Enter department name"
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
              {isCreate ? "Create Department" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default DepartmentForm;
