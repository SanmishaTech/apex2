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
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { CreateSiteData, UpdateSiteData } from "@/types/sites";
import { State } from "@/types/states";
import { City } from "@/types/cities";
import { Company } from "@/types/companies";
import useSWR, { mutate } from "swr";
import Image from "next/image";
import { Plus, X, Trash2 } from "lucide-react";
import {
  validatePAN,
  validateTAN,
  validateCIN,
  validateGST,
} from "@/lib/tax-validation";

const STATUS_OPTIONS = [
  "ONGOING",
  "HOLD",
  "CLOSED",
  "COMPLETED",
  "MOBILIZATION_STAGE",
] as const;

// Define the full contact person type from the database
export interface SiteContactPerson {
  id: number;
  siteId: number;
  name: string;
  contactNo: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

// Define the form's contact person type
export interface ContactPerson {
  id?: number;
  name: string;
  contactNo: string;
  email?: string;
}

export interface SiteFormInitialData {
  id?: number;
  siteCode?: string;
  site?: string;
  shortName?: string;
  companyId?: number;
  status?: (typeof STATUS_OPTIONS)[number];
  attachCopyUrl?: string;
  contactPersons?: ContactPerson[];
  siteContactPersons?: SiteContactPerson[];
  deliveryAddresses?: Array<{
    id?: number;
    addressLine1?: string;
    addressLine2?: string;
    stateId?: number | null;
    cityId?: number | null;
    pinCode?: string;
  }>;
  // Keeping these for backward compatibility
  contactPerson?: string;
  contactNo?: string;
  addressLine1?: string;
  addressLine2?: string;
  stateId?: number | null;
  cityId?: number;
  pinCode?: string;
  longitude?: string;
  latitude?: string;
  panNo?: string;
  gstNo?: string;
  tanNo?: string;
  cinNo?: string;
}

export interface SiteFormProps {
  mode: "create" | "edit";
  initial?: SiteFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function SiteForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/sites",
  mutate,
}: SiteFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("sites-list");
  const [attachCopyFile, setAttachCopyFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial?.attachCopyUrl || null
  );

  const schema = z.object({
    siteCode: z.string().optional().nullable(),
    site: z.string().min(1, "Site name is required"),
    shortName: z.string().optional().nullable(),
    companyId: z
      .number()
      .nullable()
      .refine((v) => typeof v === "number" && !Number.isNaN(v), {
        message: "Company is required",
      }),
    status: z.enum(STATUS_OPTIONS, {
      required_error: "Status is required",
    }),
    contactPersons: z
      .array(
        z.object({
          id: z.union([z.number(), z.string()]).optional(),
          name: z.string().min(1, "Name is required"),
          contactNo: z
            .string()
            .regex(/^\d{10}$/, "Contact number must be exactly 10 digits"),
          email: z
            .string()
            .email("Invalid email address")
            .optional()
            .or(z.literal("")),
        })
      )
      .min(1, {
        message: "At least one contact person is required",
      }),
    deliveryAddresses: z
      .array(
        z.object({
          id: z.union([z.number(), z.string()]).optional(),
          addressLine1: z.string().optional().nullable(),
          addressLine2: z.string().optional().nullable(),
          stateId: z.number().optional().nullable(),
          cityId: z.number().optional().nullable(),
          pinCode: z.string().optional().nullable(),
        })
      )
      .min(1, { message: "At least one delivery address is required" }),
    addressLine1: z.string().optional().nullable(),
    addressLine2: z.string().optional().nullable(),
    stateId: z.number().optional().nullable(),
    cityId: z.number().optional().nullable(),
    pinCode: z.string().optional().nullable(),
    longitude: z.string().optional().nullable(),
    latitude: z.string().optional().nullable(),
    panNo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || validatePAN(val), {
        message:
          "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)",
      }),
    gstNo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || validateGST(val), {
        message: "Invalid GST format. Format: 99AAAAA9999A9A9",
      }),
    tanNo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || validateTAN(val), {
        message:
          "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)",
      }),
    cinNo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || validateCIN(val), {
        message: "Invalid CIN format. Format: U99999AA9999AAA999999",
      }),
  });

  type FormValues = z.infer<typeof schema>;

  const defaultContactPersons = initial?.siteContactPersons?.length
    ? initial.siteContactPersons.map((person) => ({
        id: person.id,
        name: person.name,
        contactNo: person.contactNo,
        email: person.email || "",
      }))
    : initial?.contactPersons?.length
    ? initial.contactPersons.map((person) => ({
        id: person.id,
        name: person.name,
        contactNo: person.contactNo,
        email: person.email || "",
      }))
    : initial?.contactPerson
    ? [
        {
          name: initial.contactPerson,
          contactNo: initial.contactNo || "",
          email: "",
        },
      ]
    : [{ name: "", contactNo: "", email: "" }];

  const defaultValues: FormValues = {
    siteCode: initial?.siteCode || "",
    site: initial?.site || "",
    shortName: initial?.shortName || "",
    companyId: initial?.companyId ?? null,
    status: initial?.status || "ONGOING",
    contactPersons: defaultContactPersons,
    addressLine1: initial?.addressLine1 || "",
    addressLine2: initial?.addressLine2 || "",
    stateId: initial?.stateId ?? null,
    cityId: initial?.cityId ?? null,
    pinCode: initial?.pinCode || "",
    longitude: initial?.longitude || "",
    latitude: initial?.latitude || "",
    panNo: initial?.panNo || "",
    gstNo: initial?.gstNo || "",
    tanNo: initial?.tanNo || "",
    cinNo: initial?.cinNo || "",
    deliveryAddresses: initial?.deliveryAddresses
      ? initial.deliveryAddresses
      : [
          {
            addressLine1: initial?.addressLine1 || "",
            addressLine2: initial?.addressLine2 || "",
            stateId: initial?.stateId ?? null,
            cityId: initial?.cityId ?? null,
            pinCode: initial?.pinCode || "",
          },
        ],
  };

  // Initialize form with empty values
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    shouldUnregister: false,
    defaultValues,
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContactRow,
  } = useFieldArray({
    control: form.control,
    name: "contactPersons",
    keyName: "fieldId",
  });

  const {
    fields: addressFields,
    append: appendAddress,
    remove: removeAddressRow,
  } = useFieldArray({
    control: form.control,
    name: "deliveryAddresses",
    keyName: "fieldId",
  });

  const { control, handleSubmit, watch, setValue, register, unregister } = form;
  const statusValue = watch("status");
  const selectedStateId = watch("stateId");
  const selectedCompanyId = watch("companyId");
  const isCreate = mode === "create";

  // Debug form state
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      console.log("Form values:", value);
      console.log("Form errors:", form.formState.errors);
      console.log("Form isValid:", form.formState.isValid);
      console.log("Form isDirty:", form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Fetch companies for dropdown
  const { data: companiesData } = useSWR<{ data: Company[] }>(
    "/api/companies?perPage=100&closed=false",
    apiGet
  );
  const companies = companiesData?.data || [];

  // Fetch states for dropdown
  const { data: statesData } = useSWR<{ data: State[] }>(
    "/api/states?perPage=100",
    apiGet
  );
  const states = statesData?.data || [];

  // Fetch cities for dropdown based on selected state
  // Fetch all cities once and filter per-address locally to avoid hook-in-loop issues
  const { data: allCitiesData } = useSWR<{ data: City[] }>(
    "/api/cities?perPage=100",
    apiGet
  );
  const cities = allCitiesData?.data || [];

  // Reset city when state changes
  useEffect(() => {
    if (selectedStateId !== initial?.stateId) {
      setValue("cityId", null);
    }
  }, [selectedStateId, setValue, initial?.stateId]);

  // Handle attach copy file selection
  function handleAttachCopyChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error("Please select a valid file (PDF, DOC, DOCX, JPG, PNG)");
        return;
      }

      // Validate file size
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }

      setAttachCopyFile(file);
      // Create preview URL for files
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  // Remove attach copy
  function removeAttachCopy() {
    setAttachCopyFile(null);
    setPreviewUrl(null);
  }

  function handleRemoveContact(index: number) {
    unregister(`contactPersons.${index}` as const);
    removeContactRow(index);
  }

  function handleRemoveAddress(index: number) {
    unregister(`deliveryAddresses.${index}` as const);
    removeAddressRow(index);
  }

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      setSubmitting(true);

      const normalizeId = (value: unknown): number | undefined => {
        if (typeof value === "number" && !Number.isNaN(value)) {
          return value;
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed === "") return undefined;
          const parsed = Number(trimmed);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return undefined;
      };

      const normalizedContactPersons = data.contactPersons?.map((person) => {
        return {
          ...person,
          id: normalizeId(person.id),
        };
      });

      const normalizedDeliveryAddresses = data.deliveryAddresses?.map(
        (addr) => {
          return {
            ...addr,
            id: normalizeId(addr.id),
          };
        }
      );

      const formData = new FormData();

      // Convert contactPersons to JSON string and add to formData
      if (normalizedContactPersons && normalizedContactPersons.length > 0) {
        formData.append(
          "contactPersons",
          JSON.stringify(normalizedContactPersons)
        );
      }

      // Convert deliveryAddresses to JSON string and add to formData
      if (
        normalizedDeliveryAddresses &&
        normalizedDeliveryAddresses.length > 0
      ) {
        formData.append(
          "deliveryAddresses",
          JSON.stringify(normalizedDeliveryAddresses)
        );
        // Note: delivery addresses are persisted separately. We do not copy them
        // into the top-level site address fields automatically.
      }

      // Add all other form fields to formData
      Object.entries(data).forEach(([key, value]) => {
        if (key === "contactPersons" || key === "deliveryAddresses") return;
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });

      // Add file if present
      if (attachCopyFile) {
        formData.append("attachCopy", attachCopyFile);
      }

      let result;
      if (mode === "create") {
        result = await apiPost("/api/sites", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else if (initial?.id) {
        result = await apiPatch(`/api/sites/${initial.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      toast.success(
        mode === "create"
          ? "Site created successfully"
          : "Site updated successfully"
      );

      // Invalidate and revalidate the cache
      if (mutate) {
        await mutate();
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push("/sites");
      }
    } catch (error: any) {
      console.error("Site form submission error", error, form.formState.errors);
      console.error("Error saving site:", error);
      toast.error(
        error.response?.data?.message ||
          `Failed to ${mode === "create" ? "create" : "update"} site`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Site" : "Edit Site"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new site to the system."
              : "Update site information."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            {/* Site Details */}
            <FormSection legend="Site Details">
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="siteCode"
                  label="Site Code"
                  placeholder="Enter Site Code"
                />
                <TextInput
                  control={control}
                  name="site"
                  label="Site"
                  placeholder="Enter site name"
                  required
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="shortName"
                  label="Short Name"
                  placeholder="Enter short name"
                />
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <AppSelect
                    value={
                      selectedCompanyId
                        ? selectedCompanyId.toString()
                        : "__none"
                    }
                    onValueChange={(v) =>
                      setValue("companyId", v === "__none" ? null : Number(v), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    placeholder="Select company"
                  >
                    <AppSelect.Item value="__none">
                      Select Company
                    </AppSelect.Item>
                    {companies.map((company) => (
                      <AppSelect.Item
                        key={company.id}
                        value={company.id.toString()}
                      >
                        {company.companyName}
                        {company.shortName && ` (${company.shortName})`}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  {form.formState.errors.companyId?.message && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.companyId.message as string}
                    </p>
                  )}
                </div>
              </FormRow>
              <FormRow cols={1}>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Status
                  </label>
                  <AppSelect
                    value={statusValue}
                    onValueChange={(v) =>
                      setValue("status", v as typeof statusValue)
                    }
                    placeholder="Select status"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <AppSelect.Item key={status} value={status}>
                        {status
                          .toLowerCase()
                          .split("_")
                          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                          .join(" ")}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>

            {/* Site Address */}
            <FormSection legend="Site Address">
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="addressLine1"
                  label="Address Line 1"
                  placeholder="Enter site address line 1"
                />
              </FormRow>

              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="addressLine2"
                  label="Address Line 2"
                  placeholder="Enter site address line 2"
                />
              </FormRow>

              <FormRow cols={3}>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    State
                  </label>
                  <AppSelect
                    value={selectedStateId ? String(selectedStateId) : "__none"}
                    onValueChange={(v) =>
                      setValue("stateId", v === "__none" ? null : Number(v))
                    }
                    placeholder="Select state"
                  >
                    <AppSelect.Item value="__none">Select State</AppSelect.Item>
                    {states.map((state) => (
                      <AppSelect.Item
                        key={state.id}
                        value={state.id.toString()}
                      >
                        {state.state}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">City</label>
                  <AppSelect
                    value={watch("cityId") ? String(watch("cityId")) : "__none"}
                    onValueChange={(v) =>
                      setValue("cityId", v === "__none" ? null : Number(v))
                    }
                    placeholder="Select city"
                    disabled={!selectedStateId}
                  >
                    <AppSelect.Item value="__none">Select City</AppSelect.Item>
                    {cities
                      .filter((c: any) => c.stateId === selectedStateId)
                      .map((city: any) => (
                        <AppSelect.Item
                          key={city.id}
                          value={city.id.toString()}
                        >
                          {city.city}
                        </AppSelect.Item>
                      ))}
                  </AppSelect>
                </div>

                <TextInput
                  control={control}
                  maxLength={6}
                  name="pinCode"
                  label="Pin Code"
                  placeholder="Enter pin code"
                />
              </FormRow>

              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="longitude"
                  label="Longitude"
                  placeholder="Enter longitude"
                />
                <TextInput
                  control={control}
                  name="latitude"
                  label="Latitude"
                  placeholder="Enter latitude"
                />
              </FormRow>
            </FormSection>

            {/* Attach Copy Upload */}
            <FormSection legend="Attach Copy">
              <div className="space-y-4">
                {previewUrl && (
                  <div className="flex items-center gap-4">
                    {attachCopyFile &&
                    attachCopyFile.type.startsWith("image/") ? (
                      <div className="relative h-16 w-16 border rounded-lg overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="Attach copy preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : initial?.attachCopyUrl &&
                      initial.attachCopyUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                      <div className="relative h-16 w-16 border rounded-lg overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="Attach copy preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 border rounded-lg flex items-center justify-center bg-gray-50">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <div className="text-sm text-muted-foreground">
                        File attached: {attachCopyFile?.name || "Current file"}
                      </div>
                      <AppButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeAttachCopy}
                        iconName="X"
                      >
                        Remove File
                      </AppButton>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Upload Attach Copy
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleAttachCopyChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG. Max size: 20MB
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Contact Persons */}
            <FormSection legend="Contact Persons">
              <div className="space-y-4">
                {contactFields.map((field, index) => (
                  <div
                    key={field.fieldId}
                    className="space-y-4 p-4 border rounded-lg relative"
                  >
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        title="Remove contact person"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* Preserve DB id for contact person so PATCH can match existing rows.
                        react-hook-form's useFieldArray injects an internal `id` on each
                        field which would overwrite any DB id if we read `field.id`.
                        Use the original `initial` payload's id for the index so we
                        send the real DB id back to the server. */}
                    <input
                      type="hidden"
                      {...register(`contactPersons.${index}.id` as const)}
                      defaultValue={field.id ?? ""}
                    />
                    <FormRow cols={3}>
                      <TextInput
                        control={control}
                        name={`contactPersons.${index}.name`}
                        label="Name"
                        placeholder="Enter name"
                      />
                      <TextInput
                        control={control}
                        name={`contactPersons.${index}.contactNo`}
                        label="Contact No"
                        type="number"
                        placeholder="Enter contact number"
                      />
                      <TextInput
                        control={control}
                        name={`contactPersons.${index}.email`}
                        label="Email (Optional)"
                        placeholder="Enter email"
                        type="email"
                      />
                    </FormRow>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      appendContact({
                        id: undefined,
                        name: "",
                        contactNo: "",
                        email: "",
                      })
                    }
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Another Contact Person
                  </button>
                </div>
              </div>
            </FormSection>

            {/* Delivery Addresses: dynamic list (at least 1) */}
            <FormSection legend="Delivery Addresses">
              <div className="space-y-4">
                {addressFields.map((addr, idx) => {
                  const addrStateId = watch(`deliveryAddresses.${idx}.stateId`);
                  const addrCityId = watch(`deliveryAddresses.${idx}.cityId`);
                  const cityOptions = cities.filter(
                    (c: any) => c.stateId === addrStateId
                  );

                  return (
                    <div
                      key={addr.fieldId}
                      className="p-4 border rounded-lg relative"
                    >
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAddress(idx)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          title="Remove delivery address"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* keep DB id in a hidden field so PATCH can reference existing delivery addresses.
                          use the original `initial.deliveryAddresses` id because useFieldArray
                          adds its own internal `id` property on `addr` which is NOT the DB id */}
                      <input
                        type="hidden"
                        {...register(`deliveryAddresses.${idx}.id` as const)}
                        defaultValue={addr.id ?? ""}
                      />
                      <div className="text-sm font-medium mb-2">
                        Delivery Address {idx + 1}
                      </div>

                      <FormRow cols={1}>
                        <TextInput
                          control={control}
                          name={`deliveryAddresses.${idx}.addressLine1`}
                          label="Address Line 1"
                          placeholder="Enter address line 1"
                        />
                      </FormRow>

                      <FormRow cols={1}>
                        <TextInput
                          control={control}
                          name={`deliveryAddresses.${idx}.addressLine2`}
                          label="Address Line 2"
                          placeholder="Enter address line 2"
                        />
                      </FormRow>

                      <FormRow cols={3}>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            State
                          </label>
                          <AppSelect
                            value={addrStateId ? String(addrStateId) : "__none"}
                            onValueChange={(v) =>
                              setValue(
                                `deliveryAddresses.${idx}.stateId` as any,
                                v === "__none" ? null : Number(v)
                              )
                            }
                            placeholder="Select state"
                          >
                            <AppSelect.Item value="__none">
                              Select State
                            </AppSelect.Item>
                            {states.map((state) => (
                              <AppSelect.Item
                                key={state.id}
                                value={state.id.toString()}
                              >
                                {state.state}
                              </AppSelect.Item>
                            ))}
                          </AppSelect>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            City
                          </label>
                          <AppSelect
                            value={addrCityId ? String(addrCityId) : "__none"}
                            onValueChange={(v) =>
                              setValue(
                                `deliveryAddresses.${idx}.cityId` as any,
                                v === "__none" ? null : Number(v)
                              )
                            }
                            placeholder="Select city"
                            disabled={!addrStateId}
                          >
                            <AppSelect.Item value="__none">
                              Select City
                            </AppSelect.Item>
                            {cityOptions.map((city: any) => (
                              <AppSelect.Item
                                key={city.id}
                                value={city.id.toString()}
                              >
                                {city.city}
                              </AppSelect.Item>
                            ))}
                          </AppSelect>
                        </div>

                        <TextInput
                          control={control}
                          maxLength={6}
                          name={`deliveryAddresses.${idx}.pinCode`}
                          label="Pin Code"
                          placeholder="Enter pin code"
                        />
                      </FormRow>

                      <FormRow cols={2}>
                        {/* Delivery addresses do not store longitude/latitude (these are part of the site's primary address if used) */}
                      </FormRow>
                    </div>
                  );
                })}

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      appendAddress({
                        id: undefined,
                        addressLine1: "",
                        addressLine2: "",
                        stateId: null,
                        cityId: null,
                        pinCode: "",
                      })
                    }
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Another Delivery Address
                  </button>
                </div>
              </div>
            </FormSection>

            {/* Other Details */}
            <FormSection legend="Other Details">
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="panNo"
                  label="PAN No"
                  placeholder="Enter PAN number"
                />
                <TextInput
                  control={control}
                  name="gstNo"
                  label="GST No"
                  placeholder="Enter GST number"
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="tanNo"
                  label="TAN No"
                  placeholder="Enter TAN number"
                />
                <TextInput
                  control={control}
                  name="cinNo"
                  label="CIN No"
                  placeholder="Enter CIN number"
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
            <div className="space-y-2">
              <AppButton
                type="submit"
                iconName={isCreate ? "Plus" : "Save"}
                isLoading={submitting}
                disabled={submitting}
                className="min-w-[150px]"
              >
                {isCreate ? "Create Site" : "Save Changes"}
              </AppButton>
            </div>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default SiteForm;
