'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { RentForm } from '../rent-form';

export default function CreateRentPage() {
  useProtectPage();

  return <RentForm mode="create" />;
}
