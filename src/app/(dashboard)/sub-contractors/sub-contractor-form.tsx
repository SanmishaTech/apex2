"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { TextInput } from "@/components/common/text-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { State } from "@/types/states";
import { City } from "@/types/cities";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import {
  validatePAN,
  validateGST,
} from "@/lib/tax-validation";

const schema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  bankName: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  panNumber: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message: "Invalid PAN format",
    }),
  gstNumber: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format",
    }),
  cinNumber: z.string().optional().nullable(),
  vatTinNumber: z.string().optional().nullable(),
  cstTinNumber: z.string().optional().nullable(),
  subContractorContacts: z
    .array(
      z.object({
        id: z.number().optional(),
        contactPersonName: z.string().min(1, "Name is required"),
        mobile: z
          .string()
          .optional()
          .nullable()
          .refine((val) => !val || /^\d{10}$/.test(val), {
            message: "Mobile must be 10 digits",
          }),
        email: z
          .string()
          .email("Invalid email address")
          .optional()
          .or(z.literal(""))
          .nullable(),
      })
    )
    .optional(),
});

type FormValues = z.infer<typeof schema>;

export interface SubContractorFormProps {
  mode: "create" | "edit";
  initial?: any;
  onSuccess?: (result?: unknown) => void;
  mutate?: () => Promise<any>;
}

export function SubContractorForm({
  mode,
  initial,
  onSuccess,
  mutate,
}: SubContractorFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const defaultValues: FormValues = {
    code: initial?.code || "",
    name: initial?.name || "",
    contactPerson: initial?.contactPerson || "",
    addressLine1: initial?.addressLine1 || "",
    addressLine2: initial?.addressLine2 || "",
    pinCode: initial?.pinCode || "",
    stateId: initial?.stateId ?? null,
    cityId: initial?.cityId ?? null,
    bankName: initial?.bankName || "",
    branchName: initial?.branchName || "",
    branchCode: initial?.branchCode || "",
    accountNumber: initial?.accountNumber || "",
    ifscCode: initial?.ifscCode || "",
    panNumber: initial?.panNumber || "",
    gstNumber: initial?.gstNumber || "",
    cinNumber: initial?.cinNumber || "",
    vatTinNumber: initial?.vatTinNumber || "",
    cstTinNumber: initial?.cstTinNumber || "",
    subContractorContacts: initial?.subContractorContacts || [],
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subContractorContacts",
  });

  const { control, handleSubmit, watch, setValue } = form;
  const selectedStateId = watch("stateId");

  const { data: statesData } = useSWR<{ data: State[] }>("/api/states?perPage=100", apiGet);
  const states = statesData?.data || [];

  const { data: citiesData } = useSWR<{ data: City[] }>(
    selectedStateId ? `/api/cities?perPage=100&stateId=${selectedStateId}` : null,
    apiGet
  );
  const cities = citiesData?.data || [];

  useEffect(() => {
    if (selectedStateId && selectedStateId !== initial?.stateId) {
      // Only reset if it's not the initial value being set
      const currentCityId = form.getValues("cityId");
      if (currentCityId && !cities.find(c => c.id === currentCityId)) {
        setValue("cityId", null);
      }
    }
  }, [selectedStateId, cities, setValue, initial?.stateId, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitting(true);
      setSubmitErrors([]);

      let result;
      if (mode === "create") {
        result = await apiPost("/api/sub-contractors", data);
      } else {
        result = await apiPatch(`/api/sub-contractors/${initial.id}`, data);
      }

      toast.success(`Sub Contractor ${mode === "create" ? "created" : "updated"} successfully`);
      
      if (mutate) await mutate();
      if (onSuccess) onSuccess(result);
      else router.push("/sub-contractors");
    } catch (error: any) {
      const data = error?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        data.errors.forEach((issue: any) => {
          const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
          if (path) form.setError(path as any, { message: issue.message });
        });
      }
      setSubmitErrors(data?.message ? [data.message] : ["An error occurred"]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{mode === "create" ? "Create Sub Contractor" : "Edit Sub Contractor"}</AppCard.Title>
        </AppCard.Header>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            {submitErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {submitErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            <FormSection legend="Basic Details">
              <FormRow cols={3} from="md">
                <div>
                  <TextInput control={control} name="code" label="Code" placeholder="Auto-generated" disabled={true} readOnly={mode === "create"} />
                </div>
                <div>
                  <TextInput control={control} name="name" label="Name" placeholder="Enter Name" required />
                </div>
                <div>
                  <TextInput control={control} name="contactPerson" label="Main Contact Person" placeholder="Enter Main Contact Person" />
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Address">
              <FormRow cols={2} from="md">
                <div>
                  <TextInput control={control} name="addressLine1" label="Address Line 1" placeholder="Enter Address Line 1" />
                </div>
                <div>
                  <TextInput control={control} name="addressLine2" label="Address Line 2" placeholder="Enter Address Line 2" />
                </div>
              </FormRow>
              <FormRow cols={3} from="md">
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <AppSelect
                    value={selectedStateId ? String(selectedStateId) : "__none"}
                    onValueChange={(v) => setValue("stateId", v === "__none" ? null : Number(v))}
                  >
                    <AppSelect.Item value="__none">Select State</AppSelect.Item>
                    {states.map((s) => <AppSelect.Item key={s.id} value={String(s.id)}>{s.state}</AppSelect.Item>)}
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <AppSelect
                    value={watch("cityId") ? String(watch("cityId")) : "__none"}
                    onValueChange={(v) => setValue("cityId", v === "__none" ? null : Number(v))}
                    disabled={!selectedStateId}
                  >
                    <AppSelect.Item value="__none">Select City</AppSelect.Item>
                    {cities.map((c) => <AppSelect.Item key={c.id} value={String(c.id)}>{c.city}</AppSelect.Item>)}
                  </AppSelect>
                </div>
                <div>
                  <TextInput control={control} name="pinCode" label="Pin Code" placeholder="Enter Pin Code" />
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Additional Contacts">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-end border p-4 rounded-md relative group">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <TextInput control={control} name={`subContractorContacts.${index}.contactPersonName`} label="Name" placeholder="Enter Name" required />
                      </div>
                      <div>
                        <TextInput control={control} name={`subContractorContacts.${index}.mobile`} label="Mobile" placeholder="Enter Mobile" />
                      </div>
                      <div>
                        <TextInput control={control} name={`subContractorContacts.${index}.email`} label="Email" placeholder="Enter Email" />
                      </div>
                    </div>
                    {fields.length > 0 && (
                      <AppButton variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </AppButton>
                    )}
                  </div>
                ))}
                <AppButton type="button" size="sm" onClick={() => append({ contactPersonName: "", mobile: "", email: "" })} className="w-full bg-blue-600 text-black hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> Add Contact
                </AppButton>
              </div>
            </FormSection>

            <FormSection legend="Banking Details">
              <FormRow cols={3} from="md">
                <div>
                  <TextInput control={control} name="bankName" label="Bank Name" placeholder="Enter Bank Name" />
                </div>
                <div>
                  <TextInput control={control} name="branchName" label="Branch Name" placeholder="Enter Branch Name" />
                </div>
                <div>
                  <TextInput control={control} name="branchCode" label="Branch Code" placeholder="Enter Branch Code" />
                </div>
              </FormRow>
              <FormRow cols={2} from="md">
                <div>
                  <TextInput control={control} name="accountNumber" label="Account Number" placeholder="Enter Account Number" />
                </div>
                <div>
                  <TextInput control={control} name="ifscCode" label="IFSC Code" placeholder="Enter IFSC Code" />
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Compliance">
              <FormRow cols={3} from="md">
                <div>
                  <TextInput control={control} name="panNumber" label="PAN Number" placeholder="Enter PAN Number" />
                </div>
                <div>
                  <TextInput control={control} name="gstNumber" label="GST Number" placeholder="Enter GST Number" />
                </div>
                <div>
                  <TextInput control={control} name="cinNumber" label="CIN Number" placeholder="Enter CIN Number" />
                </div>
              </FormRow>
              <FormRow cols={2} from="md">
                <div>
                  <TextInput control={control} name="vatTinNumber" label="VAT TIN" placeholder="Enter VAT TIN" />
                </div>
                <div>
                  <TextInput control={control} name="cstTinNumber" label="CST TIN" placeholder="Enter CST TIN" />
                </div>
              </FormRow>
            </FormSection>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <AppButton type="button" variant="outline" onClick={() => router.back()}>Cancel</AppButton>
              <AppButton type="submit" isLoading={submitting}>Save Sub Contractor</AppButton>
            </div>
          </AppCard.Content>
        </form>
      </AppCard>
    </Form>
  );
}
