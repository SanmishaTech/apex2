'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import MinimumWageForm from '../minimum-wage-form';

export default function NewMinimumWagePage() {
  useProtectPage();
  return <MinimumWageForm mode='create' redirectOnSuccess='/minimum-wages' />;
}
