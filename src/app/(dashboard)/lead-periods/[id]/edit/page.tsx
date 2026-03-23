'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { LeadPeriodForm } from '../../lead-period-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { useRouter } from 'next/navigation';

export default function EditLeadPeriodPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  
  useProtectPage();
  const { can } = usePermissions();

  const canEdit = can(PERMISSIONS.EDIT_LEAD_PERIODS);

  const { data: leadPeriod, error, isLoading } = useSWR<any>(
    canEdit && id ? `/api/lead-periods/${id}` : null,
    apiGet
  );

  if (!canEdit) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-muted-foreground">
              You do not have permission to edit lead periods.
            </div>
            <div className="mt-4 flex justify-center">
              <AppButton variant="secondary" onClick={() => router.push('/lead-periods')}>
                Back
              </AppButton>
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !leadPeriod) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">
            {error?.message || 'Lead Period not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <LeadPeriodForm isEdit initialData={leadPeriod} />
    </div>
  );
}
