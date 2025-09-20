'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { ItemCategoryForm, ItemCategoryFormInitialData } from '../../item-category-form';
import { AppCard } from '@/components/common/app-card';

interface EditItemCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function EditItemCategoryPage({ params }: EditItemCategoryPageProps) {
  const { id } = use(params);
  const { data: itemCategory, error } = useSWR<ItemCategoryFormInitialData>(
    `/api/item-categories/${id}`,
    apiGet
  );

  if (error) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='text-center py-8'>
            <p className='text-red-600'>Failed to load item category</p>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!itemCategory) {
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
        <h1 className='text-2xl font-semibold text-gray-900'>Edit Item Category</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Update item category details
        </p>
      </div>

      <ItemCategoryForm mode='edit' initial={itemCategory} />
    </div>
  );
}
