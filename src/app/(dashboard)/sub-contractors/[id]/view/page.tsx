"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatDateDMY } from "@/lib/locales";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { FormRow, FormSection } from "@/components/common/app-form";
import type { SubContractor } from "@/types/sub-contractors";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium whitespace-normal break-words">
        {value !== null && value !== undefined && String(value).trim() !== "" ? value : "—"}
      </div>
    </div>
  );
}

export default function SubContractorViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? parseInt(params?.id as string, 10) : null;

  const { data, error, isLoading } = useSWR<SubContractor>(
    id ? `/api/sub-contractors/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load sub contractor");
  }

  const formattedDates = useMemo(() => {
    if (!data) return null;
    return {
      createdAt: data.createdAt ? formatDateDMY(data.createdAt) : "—",
      updatedAt: data.updatedAt ? formatDateDMY(data.updatedAt) : "—",
    };
  }, [data]);

  return (
    <div className="p-4 md:p-8">
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AppCard.Title>Sub Contractor View</AppCard.Title>
              <AppCard.Description className="whitespace-normal break-words">
                {data?.name || "Loading..."} {data?.code ? `(${data.code})` : ""}
              </AppCard.Description>
            </div>
            <div className="flex items-center gap-2">
              <AppButton
                onClick={() => router.back()}
                variant="secondary"
                iconName="ArrowLeft"
              >
                Back
              </AppButton>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {isLoading || !data ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <FormSection legend="Basic Details">
                <FormRow cols={3} from="md">
                  <Field label="Code" value={data.code} />
                  <Field label="Name" value={data.name} />
                  <Field label="Main Contact Person" value={data.contactPerson} />
                </FormRow>
              </FormSection>

              <FormSection legend="Address">
                <FormRow cols={2} from="md">
                  <Field label="Address Line 1" value={data.addressLine1} />
                  <Field label="Address Line 2" value={data.addressLine2} />
                </FormRow>
                <FormRow cols={3} from="md">
                  <Field label="State" value={data.state?.state} />
                  <Field label="City" value={data.city?.city} />
                  <Field label="Pin Code" value={data.pinCode} />
                </FormRow>
              </FormSection>

              <FormSection legend="Additional Contacts">
                {data.subContractorContacts?.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Mobile</th>
                          <th className="px-4 py-2 text-left font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.subContractorContacts?.map((contact, idx) => (
                          <tr key={contact.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                            <td className="px-4 py-2">{contact.contactPersonName}</td>
                            <td className="px-4 py-2">{contact.mobile || "—"}</td>
                            <td className="px-4 py-2">{contact.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FormSection>

              <FormSection legend="Banking Details">
                <FormRow cols={3} from="md">
                  <Field label="Bank Name" value={data.bankName} />
                  <Field label="Branch Name" value={data.branchName} />
                  <Field label="Branch Code" value={data.branchCode} />
                </FormRow>
                <FormRow cols={2} from="md">
                  <Field label="Account Number" value={data.accountNumber} />
                  <Field label="IFSC Code" value={data.ifscCode} />
                </FormRow>
              </FormSection>

              <FormSection legend="Compliance">
                <FormRow cols={3} from="md">
                  <Field label="PAN Number" value={data.panNumber} />
                  <Field label="GST Number" value={data.gstNumber} />
                  <Field label="CIN Number" value={data.cinNumber} />
                </FormRow>
                <FormRow cols={2} from="md">
                  <Field label="VAT TIN" value={data.vatTinNumber} />
                  <Field label="CST TIN" value={data.cstTinNumber} />
                </FormRow>
              </FormSection>

              <FormSection legend="Audit Details">
                <FormRow cols={2} from="md">
                  <Field label="Created At" value={formattedDates?.createdAt} />
                  <Field label="Updated At" value={formattedDates?.updatedAt} />
                </FormRow>
              </FormSection>
            </>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
