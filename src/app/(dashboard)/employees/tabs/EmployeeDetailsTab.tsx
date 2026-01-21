"use client";

import { AppSelect, ComboboxInput } from "@/components/common";
import { TextInput } from "@/components/common/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormSection, FormRow } from "@/components/common/app-form";
import type { DepartmentsResponse } from "@/types/departments";
import type { SitesResponse } from "@/types/sites";
import type { DesignationsResponse } from "@/types/designations";
import Image from "next/image";
import { DocumentUploadArray } from "./DocumentUploadArray";

interface Props {
  control: any;
  isCreate: boolean;
  departmentsData?: DepartmentsResponse;
  sitesData?: SitesResponse;
  designationsData?: DesignationsResponse;
  roleOptions: Array<{ value: string; label: string }>;
  onSignatureChange?: (file: File | null) => void;
  onProfilePicChange?: (file: File | null) => void;
  initialProfilePicUrl?: string;
  initialSignatureUrl?: string;
}

export default function EmployeeDetailsTab({
  control,
  isCreate,
  departmentsData,
  sitesData,
  designationsData,
  roleOptions,
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
                <div className="relative h-12 w-44 border rounded overflow-hidden">
                  <Image
                    src={
                      initialSignatureUrl.startsWith("http")
                        ? initialSignatureUrl
                        : `/api${initialSignatureUrl}`
                    }
                    alt="Signature Preview"
                    fill
                    className="object-contain"
                  />
                </div>
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
                <div className="relative h-16 w-16 border rounded-full overflow-hidden">
                  <Image
                    src={
                      initialProfilePicUrl.startsWith("http")
                        ? initialProfilePicUrl
                        : `/api${initialProfilePicUrl}`
                    }
                    alt="Profile Pic Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </FormRow>
      </FormSection>

      <FormSection legend="Employee Documents">
        <DocumentUploadArray control={control} />
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
          <AppSelect
            control={control}
            name="designationId"
            label="Designation"
            triggerClassName="h-9 w-full"
            placeholder="Select designation"
          >
            {designationsData?.data?.map((desig) => (
              <AppSelect.Item key={desig.id} value={String(desig.id)}>
                {desig.designationName}
              </AppSelect.Item>
            ))}
          </AppSelect>
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
          <TextInput
            control={control}
            name="previousWorkExperience"
            label="Previous Work Experience"
            placeholder="Enter previous work experience"
          />
        </FormRow>
        <FormRow cols={2}>
          <TextInput
            control={control}
            name="joinDate"
            label="Join Date"
            type="date"
            placeholder="Select join date (optional)"
          />
          <TextInput
            control={control}
            name="resignDate"
            label="Resign Date"
            type="date"
            placeholder="Select resign date (optional)"
          />
        </FormRow>
      </FormSection>

      <FormSection legend="Login Details">
        <FormRow cols={2}>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <ComboboxInput
                control={control}
                name="role"
                label="Role"
                options={roleOptions}
                placeholder="Select role"
                searchPlaceholder="Search roles..."
                emptyText="No role found."
              />
            </div>
            <FormField
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 pb-2">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                  </FormControl>
                  <FormLabel className="m-0 select-none">Active</FormLabel>
                </FormItem>
              )}
            />
          </div>
          <TextInput
            control={control}
            name="email"
            label="Email"
            type="email"
            placeholder={
              isCreate
                ? "Enter email address"
                : "Update email address (optional)"
            }
            required={isCreate}
          />
        </FormRow>
        <FormRow cols={2}>
          <TextInput
            control={control}
            name="password"
            label={isCreate ? "Password" : "Set New Password"}
            type="password"
            placeholder={
              isCreate
                ? "Enter password (min 6 characters)"
                : "Leave blank to keep current password"
            }
            required={isCreate}
          />
          <TextInput
            control={control}
            name="confirmPassword"
            label={isCreate ? "Verify Password" : "Confirm New Password"}
            type="password"
            placeholder={
              isCreate
                ? "Re-enter password"
                : "Re-enter new password if changing"
            }
            required={isCreate}
          />
        </FormRow>
      </FormSection>
    </>
  );
}
