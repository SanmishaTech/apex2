'use client';

import { CashbookForm } from '../cashbook-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

export default function NewCashbookPage() {
  useProtectPage();

  const { can } = usePermissions();
  if (!can(PERMISSIONS.CREATE_CASHBOOKS)) {
    return (
      <div className="text-muted-foreground">
        You do not have permission to add cashbooks.
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <CashbookForm mode="create" />
    </div>
  );
}
