'use client';

import { SkillSetForm } from '../skill-set-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewSkillSetPage() {
  useProtectPage();

  return (
    <SkillSetForm
      mode='create'
      redirectOnSuccess='/skill-sets'
    />
  );
}
