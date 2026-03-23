'use client';

import { LeadPeriodForm } from '../lead-period-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { useRouter } from 'next/navigation';

export default function NewLeadPeriodPage() {
  useProtectPage();
  const router = useRouter();
  const { can } = usePermissions();

  if (!can(PERMISSIONS.CREATE_LEAD_PERIODS)) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-muted-foreground">
              You do not have permission to add lead periods.
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

  return (
    <div className="container mx-auto py-6">
      <LeadPeriodForm />
    </div>
  );
}
