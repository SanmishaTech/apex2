'use client';

import { ItemCategoryForm } from '../item-category-form';

export default function NewItemCategoryPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-gray-900'>Create Item Category</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Add a new item category to the system
        </p>
      </div>

      <ItemCategoryForm mode='create' />
    </div>
  );
}
