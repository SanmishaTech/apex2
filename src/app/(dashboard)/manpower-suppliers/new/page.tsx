'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import ManpowerSupplierForm from '../manpower-supplier-form';

export default function NewManpowerSupplierPage() {
  useProtectPage();
  return <ManpowerSupplierForm mode='create' redirectOnSuccess='/manpower-suppliers' />;
}
