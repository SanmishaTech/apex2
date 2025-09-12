'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import ManpowerForm from '../manpower-form';

export default function NewManpowerPage() {
  useProtectPage([PERMISSIONS.EDIT_MANPOWER]);
  return <ManpowerForm mode='create' redirectOnSuccess='/manpower' />;
}
