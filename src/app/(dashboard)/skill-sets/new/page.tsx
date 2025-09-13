'use client';

import { SkillSetForm } from '../skill-set-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';

export default function NewSkillSetPage() {
  useProtectPage([PERMISSIONS.EDIT_SKILLSETS]);

  return (
    <SkillSetForm
      mode='create'
      redirectOnSuccess='/skill-sets'
    />
  );
}
