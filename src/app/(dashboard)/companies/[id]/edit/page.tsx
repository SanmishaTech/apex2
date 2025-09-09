'use client';

import { use, useMemo } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import CompanyForm from '../../company-form';
import { Company } from '@/types/companies';

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = use(params);
  const companyId = parseInt(id);
  
  const { data: company, error, isLoading } = useSWR<Company>(
    `/api/companies/${companyId}`,
    apiGet
  );

  const initial = useMemo(() => {
    if (!company) return null;
    return {
      id: company.id,
      companyName: company.companyName,
      shortName: company.shortName,
      contactPerson: company.contactPerson,
      contactNo: company.contactNo,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      stateId: company.stateId,
      cityId: company.cityId,
      pinCode: company.pinCode,
      logoUrl: company.logoUrl,
      closed: company.closed,
      panNo: company.panNo,
      gstNo: company.gstNo,
      tanNo: company.tanNo,
      cinNo: company.cinNo,
    };
  }, [company]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load company');
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

  return <CompanyForm mode='edit' initial={initial} />;
}
