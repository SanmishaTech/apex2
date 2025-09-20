'use client';

import { ItemForm } from '../item-form';

export default function NewItemPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-gray-900'>Create Item</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Add a new item to the system
        </p>
      </div>

      <ItemForm mode='create' />
    </div>
  );
}
