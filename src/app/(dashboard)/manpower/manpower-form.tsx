"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { TextInput } from "@/components/common/text-input";
import TextareaInput from "@/components/common/textarea-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import { UploadInput } from "@/components/common/upload-input";
import { AppSelect } from "@/components/common/app-select";
import { AppCheckbox } from "@/components/common/app-checkbox";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import useSWR from "swr";
import { ManpowerDocumentUploadArray } from "./manpower-document-array";

export interface ManpowerInitialData {
  id?: number;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  supplierId?: number | null;
  dateOfBirth?: string | null; // ISO
  address?: string | null;
  location?: string | null;
  mobileNumber?: string | null;
  wage?: string | null; // keep as string for input
  bank?: string | null;
  branch?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  pfNo?: string | null;
  esicNo?: string | null;
  unaNo?: string | null;
  panNumber?: string | null;
  panDocumentUrl?: string | null;
  aadharNo?: string | null;
  aadharDocumentUrl?: string | null;
  voterIdNo?: string | null;
  voterIdDocumentUrl?: string | null;
  drivingLicenceNo?: string | null;
  drivingLicenceDocumentUrl?: string | null;
  bankDetailsDocumentUrl?: string | null;
  bankDetails?: string | null;
  watch?: boolean;
  manpowerDocuments?: Array<{
    id?: number;
    documentName?: string | null;
    documentUrl?: string | null;
  }>;
}

export interface ManpowerFormProps {
  mode: "create" | "edit";
  initial?: ManpowerInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/manpower'
}

const documentSchema = z.object({
  id: z.number().optional(),
  documentName: z.string().min(1, "Document name is required"),
  documentUrl: z
    .any()
    .refine(
      (val) =>
        (typeof val === "string" && val.trim() !== "") || val instanceof File,
      "Document file is required"
    ),
});

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  supplierId: z.string().min(1, "Manpower supplier is required"),
  dateOfBirth: z.string().optional(), // yyyy-mm-dd
  // Contact
  address: z.string().optional(),
  location: z.string().optional(),
  mobileNumber: z.string().optional(),
  wage: z.string().optional(),
  // Bank
  bank: z.string().optional(),
  branch: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  unaNo: z.string().optional(),
  // Other numbers
  panNumber: z.string().optional(),
  aadharNo: z.string().optional(),
  voterIdNo: z.string().optional(),
  drivingLicenceNo: z.string().optional(),
  // Docs as Files in form state
  panDocument: z.any().optional(),
  aadharDocument: z.any().optional(),
  voterIdDocument: z.any().optional(),
  drivingLicenceDocument: z.any().optional(),
  bankDetailsDocument: z.any().optional(),
  bankDetails: z.string().optional(),
  // Others
  watch: z.boolean().optional(),
  manpowerDocuments: z.array(documentSchema).default([]),
});

export default function ManpowerForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/manpower",
}: ManpowerFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration("manpower-list");

  type FormValues = z.infer<typeof schema>;
  const initialDocumentValues =
    initial?.manpowerDocuments?.map((doc) => ({
      id: doc.id,
      documentName: doc.documentName ?? "",
      documentUrl: doc.documentUrl ?? "",
    })) ?? [];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: initial?.firstName || "",
      middleName: initial?.middleName || "",
      lastName: initial?.lastName || "",
      supplierId: initial?.supplierId ? String(initial.supplierId) : "",
      dateOfBirth: initial?.dateOfBirth
        ? initial.dateOfBirth.split("T")[0]
        : "",
      // Contact
      address: initial?.address || "",
      location: initial?.location || "",
      mobileNumber: initial?.mobileNumber || "",
      wage: initial?.wage || "",
      // Bank
      bank: initial?.bank || "",
      branch: initial?.branch || "",
      accountNumber: initial?.accountNumber || "",
      ifscCode: initial?.ifscCode || "",
      pfNo: initial?.pfNo || "",
      esicNo: initial?.esicNo || "",
      unaNo: initial?.unaNo || "",
      // Other
      panNumber: initial?.panNumber || "",
      aadharNo: initial?.aadharNo || "",
      voterIdNo: initial?.voterIdNo || "",
      drivingLicenceNo: initial?.drivingLicenceNo || "",
      bankDetails: initial?.bankDetails || "",
      watch: initial?.watch ?? false,
      manpowerDocuments: initialDocumentValues,
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === "create";

  // Load suppliers for dropdown
  type SuppliersResponse = { data: { id: number; supplierName: string }[] };
  const { data: suppliers } = useSWR<SuppliersResponse>(
    "/api/manpower-suppliers?perPage=100",
    apiGet
  );

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      // Always multipart for simplicity
      const fd = new FormData();
      const documents = values.manpowerDocuments || [];
      const documentMetadata = documents
        .map((doc) => {
          // Only include id if it's a valid positive number (existing document)
          const isExistingDoc = typeof doc.id === 'number' && doc.id > 0 && !doc._isNew;
          
          const metadata: any = {
            documentName: doc.documentName || "",
            documentUrl: (() => {
              if (doc.documentUrl instanceof File) {
                return doc.documentUrl;
              }
              return typeof doc.documentUrl === "string" && doc.documentUrl.trim() !== ""
                ? doc.documentUrl
                : undefined;
            })(),
          };
          
          // Only include id for existing documents (positive IDs)
          if (isExistingDoc) {
            metadata.id = doc.id;
          } else if (doc._isNew && doc._tempId) {
            // For new documents, use the temp ID for tracking during this session
            metadata._tempId = doc._tempId;
          }
          
          return metadata;
        })
        .filter(doc => doc.documentName && doc.documentUrl); // Filter out incomplete documents
      fd.append("firstName", values.firstName.trim());
      if (values.middleName) fd.append("middleName", values.middleName.trim());
      fd.append("lastName", values.lastName.trim());
      fd.append("supplierId", values.supplierId);
      if (values.dateOfBirth) fd.append("dateOfBirth", values.dateOfBirth);
      if (values.address) fd.append("address", values.address);
      if (values.location) fd.append("location", values.location);
      if (values.mobileNumber) fd.append("mobileNumber", values.mobileNumber);
      if (values.wage) fd.append("wage", values.wage);
      if (values.bank) fd.append("bank", values.bank);
      if (values.branch) fd.append("branch", values.branch);
      if (values.accountNumber)
        fd.append("accountNumber", values.accountNumber);
      if (values.ifscCode) fd.append("ifscCode", values.ifscCode);
      if (values.pfNo) fd.append("pfNo", values.pfNo);
      if (values.esicNo) fd.append("esicNo", values.esicNo);
      if (values.unaNo) fd.append("unaNo", values.unaNo);
      if (values.panNumber) fd.append("panNumber", values.panNumber);
      if (values.aadharNo) fd.append("aadharNo", values.aadharNo);
      if (values.voterIdNo) fd.append("voterIdNo", values.voterIdNo);
      if (values.drivingLicenceNo)
        fd.append("drivingLicenceNo", values.drivingLicenceNo);
      if (values.watch) fd.append("watch", String(values.watch));
      // docs
      if (values.panDocument) fd.append("panDocument", values.panDocument);
      if (values.aadharDocument)
        fd.append("aadharDocument", values.aadharDocument);
      if (values.voterIdDocument)
        fd.append("voterIdDocument", values.voterIdDocument);
      if (values.drivingLicenceDocument)
        fd.append("drivingLicenceDocument", values.drivingLicenceDocument);
      if (values.bankDetailsDocument)
        fd.append("bankDetailsDocument", values.bankDetailsDocument);
      fd.append("manpowerDocuments", JSON.stringify(documentMetadata));
      documents.forEach((doc, idx) => {
        if (doc?.documentUrl instanceof File) {
          fd.append(
            `manpowerDocuments[${idx}][documentFile]`,
            doc.documentUrl,
            doc.documentUrl.name
          );
        }
      });

      let res: any;
      if (isCreate) {
        const resp = await fetch("/api/manpower", { method: "POST", body: fd });
        const data = await resp.json().catch(() => null);
        if (!resp.ok)
          throw new Error(data?.message || "Failed to create manpower");
        res = data;
        toast.success("Manpower created");
      } else if (initial?.id) {
        fd.append("id", String(initial.id));
        const resp = await fetch("/api/manpower", {
          method: "PATCH",
          body: fd,
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok)
          throw new Error(data?.message || "Failed to update manpower");
        res = data;
        toast.success("Manpower updated");
      }
      onSuccess?.(res);
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Manpower" : "Edit Manpower"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new manpower worker."
              : "Update manpower details."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Personal Details">
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="firstName"
                  label="First Name"
                  placeholder="First name"
                  required
                  itemClassName="col-span-4"
                />
                <TextInput
                  control={control}
                  name="middleName"
                  label="Middle Name"
                  placeholder="Middle name"
                  itemClassName="col-span-4"
                />
                <TextInput
                  control={control}
                  name="lastName"
                  label="Last Name"
                  placeholder="Last name"
                  required
                  itemClassName="col-span-4"
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <AppSelect
                  control={control}
                  name="supplierId"
                  label="Manpower Supplier"
                  placeholder="Select supplier"
                  required
                  className="col-span-6"
                >
                  {suppliers?.data?.map((s) => (
                    <AppSelect.Item key={s.id} value={String(s.id)}>
                      {s.supplierName}
                    </AppSelect.Item>
                  ))}
                </AppSelect>
                <TextInput
                  control={control}
                  name="dateOfBirth"
                  label="Date of Birth"
                  type="date"
                  placeholder="YYYY-MM-DD"
                  itemClassName="col-span-6"
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Contact Details">
              <FormRow className="grid-cols-12">
                <TextareaInput
                  control={control}
                  name="address"
                  label="Address"
                  placeholder="Full address"
                  itemClassName="col-span-6"
                />
                <TextInput
                  control={control}
                  name="location"
                  label="Location"
                  placeholder="Location"
                  itemClassName="col-span-6"
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="mobileNumber"
                  label="Mobile Number"
                  placeholder="Mobile number"
                  itemClassName="col-span-6"
                />
                <TextInput
                  control={control}
                  name="wage"
                  label="Wage"
                  placeholder="0.00"
                  itemClassName="col-span-6"
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Bank Details">
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="bank"
                  label="Bank"
                  placeholder="Bank name"
                  itemClassName="col-span-6"
                />
                <TextInput
                  control={control}
                  name="branch"
                  label="Branch"
                  placeholder="Branch"
                  itemClassName="col-span-6"
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="accountNumber"
                  label="Account Number"
                  placeholder="Account number"
                  itemClassName="col-span-6"
                />
                <TextInput
                  control={control}
                  name="ifscCode"
                  label="IFSC Code"
                  placeholder="IFSC code"
                  itemClassName="col-span-6"
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="pfNo"
                  label="PF No."
                  placeholder="PF number"
                  itemClassName="col-span-6"
                />
                <TextInput
                  control={control}
                  name="esicNo"
                  label="ESIC No."
                  placeholder="ESIC number"
                  itemClassName="col-span-6"
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="unaNo"
                  label="UNA No."
                  placeholder="UNA number"
                  itemClassName="col-span-6"
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Other Details">
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="panNumber"
                  label="PAN Number"
                  placeholder="PAN"
                  itemClassName="col-span-6"
                />
                <UploadInput
                  control={control}
                  name="panDocument"
                  label="PAN Document"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  itemClassName="col-span-6"
                  showPreview
                  existingUrl={initial?.panDocumentUrl || null}
                  description="Max 20MB. Images will show a preview."
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="aadharNo"
                  label="Aadhar No"
                  placeholder="Aadhar number"
                  itemClassName="col-span-6"
                />
                <UploadInput
                  control={control}
                  name="aadharDocument"
                  label="Aadhar Document"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  itemClassName="col-span-6"
                  showPreview
                  existingUrl={initial?.aadharDocumentUrl || null}
                  description="Max 20MB. Images will show a preview."
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="voterIdNo"
                  label="Voter Id No"
                  placeholder="Voter Id number"
                  itemClassName="col-span-6"
                />
                <UploadInput
                  control={control}
                  name="voterIdDocument"
                  label="Voter Id Document"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  itemClassName="col-span-6"
                  showPreview
                  existingUrl={initial?.voterIdDocumentUrl || null}
                  description="Max 20MB. Images will show a preview."
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="drivingLicenceNo"
                  label="Driving Licence No"
                  placeholder="DL number"
                  itemClassName="col-span-6"
                />
                <UploadInput
                  control={control}
                  name="drivingLicenceDocument"
                  label="Driving Licence Document"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  itemClassName="col-span-6"
                  showPreview
                  existingUrl={initial?.drivingLicenceDocumentUrl || null}
                  description="Max 20MB. Images will show a preview."
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <TextInput
                  control={control}
                  name="bankDetails"
                  label="Bank Details"
                  placeholder="Bank details"
                  itemClassName="col-span-6"
                />
                <UploadInput
                  control={control}
                  name="bankDetailsDocument"
                  label="Bank Details Document"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  itemClassName="col-span-6"
                  showPreview
                  existingUrl={initial?.bankDetailsDocumentUrl || null}
                  description="Max 20MB. Images will show a preview."
                />
              </FormRow>
              <FormRow className="grid-cols-12">
                <div className="col-span-6">
                  <AppCheckbox
                    label="Watch"
                    checked={!!form.watch("watch")}
                    onCheckedChange={(v) => form.setValue("watch", v)}
                  />
                </div>
                <div className="col-span-6" />
              </FormRow>
            </FormSection>

            <FormSection legend="Documents">
              <ManpowerDocumentUploadArray control={control} />
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
              {isCreate ? "Create Manpower" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
