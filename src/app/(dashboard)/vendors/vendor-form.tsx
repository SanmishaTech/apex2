"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { AppButton, AppCard } from "@/components/common";
import { TextInput } from "@/components/common/text-input";
import { SelectInput } from "@/components/common/select-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// Types
type BankAccountData = {
  id?: number;
  bank?: string;
  branch?: string;
  branchCode?: string;
  accountNumber?: string;
  ifscCode?: string;
};

type VendorFormInitialData = {
  id?: number;
  vendorName: string;
  contactPerson?: string;
  addressLine1: string;
  addressLine2?: string;
  stateId?: number;
  cityId?: number;
  pincode?: string;
  mobile1?: string;
  mobile2?: string;
  email?: string;
  alternateEmail1?: string;
  alternateEmail2?: string;
  alternateEmail3?: string;
  alternateEmail4?: string;
  landline1?: string;
  landline2?: string;
  bank?: string;
  branch?: string;
  branchCode?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  vatTinNumber?: string;
  cstTinNumber?: string;
  gstNumber?: string;
  cinNumber?: string;
  serviceTaxNumber?: string;
  stateCode?: string;
  itemCategoryIds?: number[];
  bankAccounts?: BankAccountData[];
};

type VendorFormProps = {
  mode: "create" | "edit";
  initial?: VendorFormInitialData;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/vendors'
};

const inputSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  stateId: z.string().optional().or(z.literal("")),
  cityId: z.string().optional().or(z.literal("")),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional()
    .or(z.literal("")),
  mobile1: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits")
    .optional()
    .or(z.literal("")),
  mobile2: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  alternateEmail1: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  alternateEmail2: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  alternateEmail3: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  alternateEmail4: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  landline1: z
    .string()
    .regex(/^[\d\s\-\+\(\)]{10,15}$/, "Invalid landline format")
    .optional()
    .or(z.literal("")),
  landline2: z
    .string()
    .regex(/^[\d\s\-\+\(\)]{10,15}$/, "Invalid landline format")
    .optional()
    .or(z.literal("")),
  bank: z.string().optional(),
  branch: z.string().optional(),
  branchCode: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .regex(
      /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      "Invalid PAN format (e.g., ABCDE1234F)"
    )
    .optional()
    .or(z.literal("")),
  vatTinNumber: z
    .string()
    .regex(/^[0-9]{11}$/, "VAT TIN must be 11 digits")
    .optional()
    .or(z.literal("")),
  cstTinNumber: z
    .string()
    .regex(/^[0-9]{11}$/, "CST TIN must be 11 digits")
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST format"
    )
    .optional()
    .or(z.literal("")),
  cinNumber: z
    .string()
    .regex(
      /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
      "Invalid CIN format"
    )
    .optional()
    .or(z.literal("")),
  serviceTaxNumber: z.string().optional(),
  stateCode: z
    .string()
    .regex(/^[0-9]{2}$/, "State code must be 2 digits")
    .optional()
    .or(z.literal("")),
  itemCategoryIds: z.array(z.string()).optional(),
  bankAccounts: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]).optional(),
        bank: z.string().optional(),
        branch: z.string().optional(),
        branchCode: z.string().optional(),
        accountNumber: z.string().optional(),
        ifscCode: z
          .string()
          .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
          .optional()
          .or(z.literal("")),
      })
    )
    .optional(),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
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

  return {
    vendorName: data.vendorName?.trim() || null,
    contactPerson: data.contactPerson?.trim() || null,
    addressLine1: data.addressLine1?.trim() || null,
    addressLine2: data.addressLine2?.trim() || null,
    stateId: data.stateId ? parseInt(data.stateId) : null,
    cityId: data.cityId ? parseInt(data.cityId) : null,
    pincode: data.pincode?.trim() || null,
    mobile1: data.mobile1?.trim() || null,
    mobile2: data.mobile2?.trim() || null,
    email: data.email?.trim() || null,
    alternateEmail1: data.alternateEmail1?.trim() || null,
    alternateEmail2: data.alternateEmail2?.trim() || null,
    alternateEmail3: data.alternateEmail3?.trim() || null,
    alternateEmail4: data.alternateEmail4?.trim() || null,
    landline1: data.landline1?.trim() || null,
    landline2: data.landline2?.trim() || null,
    bank: data.bank?.trim() || null,
    branch: data.branch?.trim() || null,
    branchCode: data.branchCode?.trim() || null,
    accountNumber: data.accountNumber?.trim() || null,
    ifscCode: data.ifscCode?.trim() || null,
    panNumber: data.panNumber?.trim() || null,
    vatTinNumber: data.vatTinNumber?.trim() || null,
    cstTinNumber: data.cstTinNumber?.trim() || null,
    gstNumber: data.gstNumber?.trim() || null,
    cinNumber: data.cinNumber?.trim() || null,
    serviceTaxNumber: data.serviceTaxNumber?.trim() || null,
    stateCode: data.stateCode?.trim() || null,
    itemCategoryIds: data.itemCategoryIds
      ? data.itemCategoryIds.map((id) => parseInt(id))
      : null,
    bankAccounts: data.bankAccounts
      ? data.bankAccounts
          .filter(
            (acc) =>
              acc.bank ||
              acc.branch ||
              acc.branchCode ||
              acc.accountNumber ||
              acc.ifscCode
          )
          .map((acc) => ({
            id: normalizeId((acc as { id?: unknown }).id),
            bank: acc.bank?.trim() || null,
            branch: acc.branch?.trim() || null,
            branchCode: acc.branchCode?.trim() || null,
            accountNumber: acc.accountNumber?.trim() || null,
            ifscCode: acc.ifscCode?.trim() || null,
          }))
      : null,
  };
}

export function VendorForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess,
}: VendorFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      vendorName: initial?.vendorName ?? "",
      contactPerson: initial?.contactPerson ?? "",
      addressLine1: initial?.addressLine1 ?? "",
      addressLine2: initial?.addressLine2 ?? "",
      stateId: initial?.stateId ? String(initial.stateId) : "",
      cityId: initial?.cityId ? String(initial.cityId) : "",
      pincode: initial?.pincode ?? "",
      mobile1: initial?.mobile1 ?? "",
      mobile2: initial?.mobile2 ?? "",
      email: initial?.email ?? "",
      alternateEmail1: initial?.alternateEmail1 ?? "",
      alternateEmail2: initial?.alternateEmail2 ?? "",
      alternateEmail3: initial?.alternateEmail3 ?? "",
      alternateEmail4: initial?.alternateEmail4 ?? "",
      landline1: initial?.landline1 ?? "",
      landline2: initial?.landline2 ?? "",
      bank: initial?.bank ?? "",
      branch: initial?.branch ?? "",
      branchCode: initial?.branchCode ?? "",
      accountNumber: initial?.accountNumber ?? "",
      ifscCode: initial?.ifscCode ?? "",
      panNumber: initial?.panNumber ?? "",
      vatTinNumber: initial?.vatTinNumber ?? "",
      cstTinNumber: initial?.cstTinNumber ?? "",
      gstNumber: initial?.gstNumber ?? "",
      cinNumber: initial?.cinNumber ?? "",
      serviceTaxNumber: initial?.serviceTaxNumber ?? "",
      stateCode: initial?.stateCode ?? "",
      itemCategoryIds: initial?.itemCategoryIds
        ? initial.itemCategoryIds.map((id) => String(id))
        : [],
      bankAccounts:
        initial?.bankAccounts?.map((acc) => ({
          id: acc.id, // Keep existing ID
          bank: acc.bank || "",
          branch: acc.branch || "",
          branchCode: acc.branchCode || "",
          accountNumber: acc.accountNumber || "",
          ifscCode: acc.ifscCode || "",
        })) || [],
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    register,
    unregister,
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "bankAccounts",
    keyName: "fieldId",
  });
  const selectedStateId = watch("stateId");

  // Function to add a new bank account with explicit id: undefined
  const addNewBankAccount = () => {
    const newAccount: BankAccountData = {
      id: undefined,
      bank: "",
      branch: "",
      branchCode: "",
      accountNumber: "",
      ifscCode: "",
    };
    append(newAccount);
  };

  const handleRemoveBankAccount = (index: number) => {
    unregister(`bankAccounts.${index}` as const);
    remove(index);
  };

  // Fetch states for dropdown
  const { data: states } = useSWR("/api/states?perPage=100", apiGet);

  // Fetch cities for dropdown based on selected state
  const { data: cities } = useSWR(
    selectedStateId
      ? `/api/cities?perPage=100&stateId=${selectedStateId}`
      : null,
    apiGet
  );

  // Fetch item categories for dropdown
  const { data: itemCategories } = useSWR(
    "/api/item-categories?perPage=100",
    apiGet
  );

  // Reset city when state changes
  useEffect(() => {
    if (selectedStateId !== (initial?.stateId ? String(initial.stateId) : "")) {
      setValue("cityId", "");
    }
  }, [selectedStateId, setValue, initial?.stateId]);

  // Add effect to style asterisks red after component mounts
  useEffect(() => {
    const styleAsterisks = () => {
      const labels = document.querySelectorAll("label");
      labels.forEach((label) => {
        const text = label.textContent || "";
        if (text.includes("*")) {
          const parts = text.split("*");
          if (parts.length === 2) {
            label.innerHTML = `${parts[0]}<span style="color: #ef4444; font-weight: bold;">*</span>${parts[1]}`;
          }
        }
      });
    };

    // Run after a short delay to ensure DOM is ready
    const timer = setTimeout(styleAsterisks, 100);
    return () => clearTimeout(timer);
  }, []);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      let result;
      if (mode === "create") {
        result = await apiPost("/api/vendors", payload);
      } else {
        result = await apiPatch(`/api/vendors/${initial?.id}`, payload);
      }

      toast.success(
        `Vendor ${mode === "create" ? "created" : "updated"} successfully`
      );

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(redirectOnSuccess || "/vendors");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Prepare dropdown options
  const stateOptions =
    (states as any)?.data?.map((state: any) => ({
      value: String(state.id),
      label: state.state,
    })) || [];

  const cityOptions =
    (cities as any)?.data?.map((city: any) => ({
      value: String(city.id),
      label: city.city,
    })) || [];

  const itemCategoryOptions =
    (itemCategories as any)?.data?.map((category: any) => ({
      value: String(category.id),
      label: category.itemCategory,
    })) || [];

  return (
    <>
      <style jsx global>{`
        .uppercase {
          text-transform: uppercase;
        }
      `}</style>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>
                {mode === "create" ? "Add New Vendor" : "Edit Vendor"}
              </AppCard.Title>
              <AppCard.Description>
                {mode === "create"
                  ? "Create a new vendor with contact and business details."
                  : "Update vendor information and business details."}
              </AppCard.Description>
            </AppCard.Header>
            <AppCard.Content>
              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Basic Information
                  </span>
                }
              >
                {/* Row 1: Vendor Name & Contact Person */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="vendorName"
                    label="Vendor Name *"
                    placeholder="Enter vendor name"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="contactPerson"
                    label="Contact Person *"
                    placeholder="Enter contact person name"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 2: Address Lines */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="addressLine1"
                    label="Address Line 1 *"
                    placeholder="Enter address line 1"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="addressLine2"
                    label="Address Line 2"
                    placeholder="Enter address line 2"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 3: State, City, Pincode */}
                <FormRow cols={3} from="md">
                  <SelectInput
                    control={control}
                    name="stateId"
                    label="State"
                    placeholder="Select state"
                    options={stateOptions}
                    span={1}
                    spanFrom="md"
                  />
                  <SelectInput
                    control={control}
                    name="cityId"
                    label="City"
                    placeholder="Select city"
                    options={cityOptions}
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="pincode"
                    label="Pincode"
                    placeholder="Enter 6-digit pincode"
                    maxLength={6}
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Item Categories
                  </span>
                }
              >
                <FormRow>
                  <MultiSelectInput
                    control={control}
                    name="itemCategoryIds"
                    label="Item Categories"
                    placeholder="Select item categories"
                    options={itemCategoryOptions}
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Contact Information
                  </span>
                }
              >
                {/* Row 4: Mobile Numbers */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="mobile1"
                    label="Mobile 1"
                    placeholder="e.g., 9876543210"
                    maxLength={10}
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="mobile2"
                    label="Mobile 2"
                    placeholder="e.g., 9876543210"
                    maxLength={10}
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 5: Primary Email */}
                <FormRow>
                  <TextInput
                    control={control}
                    name="email"
                    label="Email"
                    placeholder="Enter email address"
                    type="email"
                  />
                </FormRow>

                {/* Row 6: Alternate Emails - First Row */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="alternateEmail1"
                    label="Alternate Email 1"
                    placeholder="Enter alternate email 1"
                    type="email"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="alternateEmail2"
                    label="Alternate Email 2"
                    placeholder="Enter alternate email 2"
                    type="email"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 7: Alternate Emails - Second Row */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="alternateEmail3"
                    label="Alternate Email 3"
                    placeholder="Enter alternate email 3"
                    type="email"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="alternateEmail4"
                    label="Alternate Email 4"
                    placeholder="Enter alternate email 4"
                    type="email"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 8: Landlines */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="landline1"
                    label="Landline 1"
                    placeholder="e.g., +91-11-12345678"
                    maxLength={15}
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="landline2"
                    label="Landline 2"
                    placeholder="e.g., +91-11-12345678"
                    maxLength={15}
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Banking Information (Primary Account)
                  </span>
                }
              >
                {/* Row 9: Bank Details - First Row */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="bank"
                    label="Bank"
                    placeholder="Enter bank name"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="branch"
                    label="Branch"
                    placeholder="Enter branch name"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 10: Bank Details - Second Row */}
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="branchCode"
                    label="Branch Code"
                    placeholder="Enter branch code"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="accountNumber"
                    label="Account Number"
                    placeholder="Enter account number"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="ifscCode"
                    label="IFSC Code"
                    placeholder="e.g., SBIN0001234"
                    maxLength={11}
                    className="uppercase"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Additional Bank Accounts
                  </span>
                }
              >
                <div className="flex justify-between items-center mb-6 pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {fields.length === 0
                        ? "You can add up to 3 additional bank accounts."
                        : `Bank Accounts Added:`}
                    </span>
                    {fields.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {fields.length} of 3
                      </span>
                    )}
                  </div>
                  {fields.length < 3 && (
                    <AppButton
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={addNewBankAccount}
                      iconName="Plus"
                    >
                      Add Bank Account
                    </AppButton>
                  )}
                </div>
                {fields.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No additional bank accounts added yet.
                  </div>
                )}
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.fieldId}
                      className="border border-gray-200 rounded-lg p-5 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <h4 className="font-semibold text-base text-gray-800">
                            Bank Account {index + 1}
                          </h4>
                        </div>
                        <AppButton
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveBankAccount(index)}
                          iconName="Trash2"
                        >
                          Remove
                        </AppButton>
                      </div>
                      <div className="space-y-4">
                        <input
                          type="hidden"
                          {...register(`bankAccounts.${index}.id` as const)}
                          defaultValue={field.id ?? ""}
                        />
                        <FormRow cols={2} from="md">
                          <TextInput
                            control={control}
                            name={`bankAccounts.${index}.bank`}
                            label="Bank"
                            placeholder="Enter bank name"
                            span={1}
                            spanFrom="md"
                          />
                          <TextInput
                            control={control}
                            name={`bankAccounts.${index}.branch`}
                            label="Branch"
                            placeholder="Enter branch name"
                            span={1}
                            spanFrom="md"
                          />
                        </FormRow>
                        <FormRow cols={3} from="md">
                          <TextInput
                            control={control}
                            name={`bankAccounts.${index}.branchCode`}
                            label="Branch Code"
                            placeholder="Enter branch code"
                            span={1}
                            spanFrom="md"
                          />
                          <TextInput
                            control={control}
                            name={`bankAccounts.${index}.accountNumber`}
                            label="Account Number"
                            placeholder="Enter account number"
                            span={1}
                            spanFrom="md"
                          />
                          <TextInput
                            control={control}
                            name={`bankAccounts.${index}.ifscCode`}
                            label="IFSC Code"
                            placeholder="e.g., SBIN0001234"
                            maxLength={11}
                            className="uppercase"
                            span={1}
                            spanFrom="md"
                          />
                        </FormRow>
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Tax Information
                  </span>
                }
              >
                {/* Row 11: Tax Numbers - First Row */}
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="panNumber"
                    label="PAN Number"
                    placeholder="e.g., ABCDE1234F"
                    maxLength={10}
                    className="uppercase"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="vatTinNumber"
                    label="VAT TIN Number"
                    placeholder="Enter 11-digit VAT TIN"
                    maxLength={11}
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="cstTinNumber"
                    label="CST TIN Number"
                    placeholder="Enter 11-digit CST TIN"
                    maxLength={11}
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 12: Tax Numbers - Second Row */}
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="gstNumber"
                    label="GST Number"
                    placeholder="e.g., 22AAAAA0000A1Z5"
                    maxLength={15}
                    className="uppercase"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="cinNumber"
                    label="CIN Number"
                    placeholder="e.g., L12345MH2020PLC123456"
                    maxLength={21}
                    className="uppercase"
                    span={1}
                    spanFrom="md"
                  />
                  <TextInput
                    control={control}
                    name="serviceTaxNumber"
                    label="Service Tax Number"
                    placeholder="Enter service tax number"
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>

                {/* Row 13: State Code */}
                <FormRow cols={2} from="md">
                  <TextInput
                    control={control}
                    name="stateCode"
                    label="State Code"
                    placeholder="e.g., 27"
                    maxLength={2}
                    span={1}
                    spanFrom="md"
                  />
                </FormRow>
              </FormSection>
            </AppCard.Content>

            <AppCard.Footer className="justify-end">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancel
              </AppButton>
              <AppButton type="submit" isLoading={submitting}>
                {mode === "create" ? "Create Vendor" : "Update Vendor"}
              </AppButton>
            </AppCard.Footer>
          </AppCard>
        </form>
      </Form>
    </>
  );
}
