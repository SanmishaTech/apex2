'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SkillSetForm, SkillSetFormInitialData } from '../../skill-set-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditSkillSetPage() {
  useProtectPage();

  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<SkillSetFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSkillSet() {
      try {
        const skillSet = await apiGet(`/api/skill-sets/${id}`);
        setInitial(skillSet);
      } catch (error) {
        toast.error('Failed to load skill set');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchSkillSet();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!initial) {
    return <div>Skill set not found</div>;
  }

  return (
    <SkillSetForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/skill-sets'
    />
  );
}
