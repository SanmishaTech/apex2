'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { apiGet } from '@/lib/api-client';
import { VendorForm } from '../../vendor-form';
import { AppCard } from '@/components/common';

type VendorEditPageProps = {
  params: Promise<{ id: string }>;
};

export default function VendorEditPage({ params }: VendorEditPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: vendor, error, isLoading } = useSWR(`/api/vendors/${id}`, apiGet) as { data: any, error: any, isLoading: boolean };

  if (isLoading) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-muted-foreground'>Loading vendor...</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (error || !vendor) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-destructive'>Failed to load vendor</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  const initialData = {
    id: vendor.id,
    vendorName: vendor.vendorName,
    contactPerson: vendor.contactPerson,
    addressLine1: vendor.addressLine1,
    addressLine2: vendor.addressLine2,
    stateId: vendor.stateId,
    cityId: vendor.cityId,
    pincode: vendor.pincode,
    mobile1: vendor.mobile1,
    mobile2: vendor.mobile2,
    email: vendor.email,
    alternateEmail1: vendor.alternateEmail1,
    alternateEmail2: vendor.alternateEmail2,
    alternateEmail3: vendor.alternateEmail3,
    alternateEmail4: vendor.alternateEmail4,
    landline1: vendor.landline1,
    landline2: vendor.landline2,
    bank: vendor.bank,
    branch: vendor.branch,
    branchCode: vendor.branchCode,
    accountNumber: vendor.accountNumber,
    ifscCode: vendor.ifscCode,
    panNumber: vendor.panNumber,
    vatTinNumber: vendor.vatTinNumber,
    cstTinNumber: vendor.cstTinNumber,
    gstNumber: vendor.gstNumber,
    cinNumber: vendor.cinNumber,
    serviceTaxNumber: vendor.serviceTaxNumber,
    stateCode: vendor.stateCode,
    itemCategoryIds: vendor.itemCategories?.map((ic: any) => ic.itemCategory.id) || [],
    bankAccounts: vendor.bankAccounts || [],
  };

  const handleSuccess = async () => {
    // Revalidate the cache to get fresh data
    await mutate(`/api/vendors/${id}`);
    // Navigate to vendors list
    router.push('/vendors');
  };

  return <VendorForm mode='edit' initial={initialData} onSuccess={handleSuccess} />;
}
