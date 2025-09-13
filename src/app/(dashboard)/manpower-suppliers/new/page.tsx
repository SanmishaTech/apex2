'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import ManpowerSupplierForm from '../manpower-supplier-form';

export default function NewManpowerSupplierPage() {
  useProtectPage([PERMISSIONS.EDIT_MANPOWER_SUPPLIERS]);
  return <ManpowerSupplierForm mode='create' redirectOnSuccess='/manpower-suppliers' />;
}
