'use client';

import { BillingAddressForm } from '../billing-address-form';

export default function NewBillingAddressPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-gray-900'>Create Billing Address</h1>
        <p className='mt-1 text-sm text-gray-500'>
          Add a new billing address to the system
        </p>
      </div>

      <BillingAddressForm mode='create' />
    </div>
  );
}
