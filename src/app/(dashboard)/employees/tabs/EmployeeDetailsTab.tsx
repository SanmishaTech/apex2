"use client";

import { AppSelect, ComboboxInput } from "@/components/common";
import { TextInput } from "@/components/common/text-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { FormSection, FormRow } from "@/components/common/app-form";
import type { DepartmentsResponse } from "@/types/departments";
import type { SitesResponse } from "@/types/sites";
import { ROLES } from "@/config/roles";

interface Props {
  control: any;
  isCreate: boolean;
  departmentsData?: DepartmentsResponse;
  sitesData?: SitesResponse;
  onSignatureChange?: (file: File | null) => void;
  onProfilePicChange?: (file: File | null) => void;
  initialProfilePicUrl?: string;
  initialSignatureUrl?: string;
}

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

function getRoleLabel(r: string) {
  if (r === "projectManager") return "Project Manager";
  if (r === "siteEngineer") return "Site Engineer";
  if (r === "siteIncharge") return "Site Incharge";
  if (r === "projectUser") return "Project User";
  if (r === "humanResources") return "HR";
  if (r === "storeIncharge") return "Store Incharge";
  if (r === "siteSupervisor") return "Site Supervisor";
  if (r === "generalManager") return "General Manager";
  if (r === "safetyIncharge") return "Safety Incharge";
  if (r === "billingAssistant") return "Billing Assistant";
  if (r === "purchaseManager") return "Purchase Manager";
  if (r === "qaqc") return "QA/QC";
  if (r === "businessDevelopment") return "Business Development";
  if (r === "internalAuditor") return "Internal Auditor";
  if (r === "externalAuditor") return "External Auditor";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

const roleOptions = ROLE_VALUES.map((r) => ({
  value: r,
  label: getRoleLabel(r),
}));

export default function EmployeeDetailsTab({
  control,
  isCreate,
  departmentsData,
  sitesData,
  onSignatureChange,
  onProfilePicChange,
  initialProfilePicUrl,
  initialSignatureUrl,
}: Props) {
  console.log(
    "DEBUG: initialSignatureUrl",
    initialSignatureUrl,
    typeof initialSignatureUrl
  );
  return (
    <>
      <FormSection legend="Upload Signature / Profile Pic">
        <FormRow cols={2}>
          <div>
            <label className="block text-sm font-medium mb-2">
              Signature (max 20MB, recommended 3.5cm x 1.5cm, allowed file
              types: JPEG, PNG)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onSignatureChange?.(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {/* Show preview if editing and initialSignatureUrl is provided */}
            {!isCreate && initialSignatureUrl && (
              <div className="mt-2">
                <img
                  src={
                    initialSignatureUrl.startsWith("/")
                      ? `${window.location.origin}${initialSignatureUrl}`
                      : initialSignatureUrl
                  }
                  alt="Signature Preview"
                  className="h-12 w-44 rounded border"
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Profile Pic (passport size, max 20MB, recommended 3.5cm x 4.5cm,
              allowed file types: JPEG, PNG)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                onProfilePicChange?.(e.target.files?.[0] || null)
              }
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {/* Show preview if editing and initialProfilePicUrl is provided */}
            {!isCreate && initialProfilePicUrl && (
              <div className="mt-2">
                <img
                  src={
                    initialProfilePicUrl.startsWith("/")
                      ? `${window.location.origin}${initialProfilePicUrl}`
                      : initialProfilePicUrl
                  }
                  alt="Profile Pic Preview"
                  className="h-16 w-16 rounded-full border"
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
          </div>
        </FormRow>
      </FormSection>

      <FormSection legend="Employee Information">
        <FormRow cols={2}>
          <TextInput
            control={control}
            name="name"
            label="Employee Name"
            placeholder="Enter employee full name"
            required
          />
          <div />
        </FormRow>
        <FormRow cols={2}>
          <AppSelect
            control={control}
            name="departmentId"
            label="Department"
            triggerClassName="h-9 w-full"
            placeholder="Select department"
          >
            {departmentsData?.data?.map((dept) => (
              <AppSelect.Item key={dept.id} value={String(dept.id)}>
                {dept.department}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <MultiSelectInput
            control={control}
            name="siteId"
            label="Site"
            placeholder="Select sites"
            options={
              sitesData?.data?.map((site) => ({
                value: String(site.id),
                label: site.site,
              })) || []
            }
          />
        </FormRow>
        <FormRow cols={2}>
          <TextInput
            control={control}
            name="resignDate"
            label="Resign Date"
            type="date"
            placeholder="Select resign date (optional)"
          />
          <div />
        </FormRow>
      </FormSection>

      {isCreate && (
        <FormSection legend="Login Details">
          <FormRow cols={2}>
            <ComboboxInput
              control={control}
              name="role"
              label="Role"
              options={roleOptions}
              placeholder="Select role"
              searchPlaceholder="Search roles..."
              emptyText="No role found."
            />
            <TextInput
              control={control}
              name="email"
              label="Email"
              type="email"
              placeholder="Enter email address"
              required
            />
          </FormRow>
          <FormRow cols={2}>
            <TextInput
              control={control}
              name="password"
              label="Password"
              type="password"
              placeholder="Enter password (min 6 characters)"
              required
            />
            <TextInput
              control={control}
              name="confirmPassword"
              label="Verify Password"
              type="password"
              placeholder="Re-enter password"
              required
            />
          </FormRow>
        </FormSection>
      )}
    </>
  );
}
