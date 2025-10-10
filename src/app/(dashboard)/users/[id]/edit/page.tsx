'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import UserForm, { UserFormInitialData } from '@/app/(dashboard)/users/user-form';

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<UserFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ id: number; name: string | null; email: string; role: string; status: boolean }>(`/api/users/${id}`);
        setInitial({
          id: data.id,
          name: data.name || '',
          email: data.email,
          role: data.role,
          status: data.status,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load user');
        router.push('/users');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, router]);


  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }
    return (
      <UserForm mode='edit' initial={initial} />
    );
}
