'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import NoticeForm from '@/app/(dashboard)/notices/notice-form';

export default function NewNoticePage() {
  useProtectPage();
  return <NoticeForm mode='create' />;
}


