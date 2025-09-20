'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { PaymentTermForm } from '../../payment-term-form';
import { AppCard } from '@/components/common';

type PaymentTermEditPageProps = {
  params: Promise<{ id: string }>;
};

export default function PaymentTermEditPage({ params }: PaymentTermEditPageProps) {
  const { id } = use(params);
  const { data: paymentTerm, error, isLoading } = useSWR(`/api/payment-terms/${id}`, apiGet) as { data: any, error: any, isLoading: boolean };

  if (isLoading) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-muted-foreground'>Loading payment term...</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (error || !paymentTerm) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-destructive'>Failed to load payment term</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  const initialData = {
    id: paymentTerm.id,
    paymentTerm: paymentTerm.paymentTerm,
    description: paymentTerm.description,
  };

  return <PaymentTermForm mode='edit' initial={initialData} />;
}
