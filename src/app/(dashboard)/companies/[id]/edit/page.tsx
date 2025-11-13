"use client";

import { use, useMemo } from "react";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import CompanyForm from "../../company-form";
import { Company } from "@/types/companies";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = use(params);
  const companyId = parseInt(id);

  const {
    data: company,
    error,
    isLoading,
  } = useSWR<Company>(`/api/companies/${companyId}`, apiGet);

  const initial = useMemo(() => {
    if (!company) return null;
    return {
      id: company.id,
      companyName: company.companyName,
      shortName: company.shortName ?? undefined,
      contactPerson: company.contactPerson ?? undefined,
      contactNo: company.contactNo ?? undefined,
      addressLine1: company.addressLine1 ?? undefined,
      addressLine2: company.addressLine2 ?? undefined,
      stateId: company.stateId ?? undefined,
      cityId: company.cityId ?? undefined,
      pinCode: company.pinCode ?? undefined,
      logoUrl: company.logoUrl ?? undefined,
      closed: company.closed,
      panNo: company.panNo ?? undefined,
      gstNo: company.gstNo ?? undefined,
      tanNo: company.tanNo ?? undefined,
      cinNo: company.cinNo ?? undefined,
      companyDocuments: (company as any).companyDocuments ?? [],
    };
  }, [company]);

  if (error) {
    toast.error((error as Error).message || "Failed to load company");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load company. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Loading company...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Company not found.
        </div>
      </div>
    );
  }

  if (isNaN(companyId)) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Invalid company ID.
        </div>
      </div>
    );
  }

  return <CompanyForm mode="edit" initial={initial} />;
}
