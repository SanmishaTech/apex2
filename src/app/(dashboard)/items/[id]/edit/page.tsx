'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { ItemForm, ItemFormInitialData } from '../../item-form';
import { AppCard } from '@/components/common/app-card';

interface EditItemPageProps {
  params: Promise<{ id: string }>;
}

export default function EditItemPage({ params }: EditItemPageProps) {
  const { id } = use(params);
  const { data: item, error } = useSWR<ItemFormInitialData>(
    `/api/items/${id}`,
    apiGet
  );

  if (error) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='text-center py-8'>
            <p className='text-red-600'>Failed to load item</p>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!item) {
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
        <h1 className='text-2xl font-semibold text-gray-900'>Edit Item</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Update item details
        </p>
      </div>

      <ItemForm mode='edit' initial={item} />
    </div>
  );
}
