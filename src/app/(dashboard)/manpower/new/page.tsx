'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import ManpowerForm from '../manpower-form';

export default function NewManpowerPage() {
  useProtectPage();
  return <ManpowerForm mode='create' redirectOnSuccess='/manpower' />;
}
