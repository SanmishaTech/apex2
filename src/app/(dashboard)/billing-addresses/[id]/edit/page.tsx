'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { BillingAddressForm, BillingAddressFormInitialData } from '../../billing-address-form';
import { AppCard } from '@/components/common/app-card';

interface EditBillingAddressPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBillingAddressPage({ params }: EditBillingAddressPageProps) {
  const { id } = use(params);
  const { data: billingAddress, error, mutate } = useSWR<BillingAddressFormInitialData>(
    `/api/billing-addresses/${id}`,
    apiGet
  );

  if (error) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='text-center py-8'>
            <p className='text-red-600'>Failed to load billing address</p>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!billingAddress) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='text-center py-8'>
            <p className='text-gray-500'>Loading...</p>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-gray-900'>Edit Billing Address</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Update billing address details
        </p>
      </div>

      <BillingAddressForm mode='edit' initial={billingAddress} mutate={mutate} />
    </div>
  );
}
