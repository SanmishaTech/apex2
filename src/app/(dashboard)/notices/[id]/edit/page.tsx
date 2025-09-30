'use client';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import NoticeForm from '@/app/(dashboard)/notices/notice-form';
import { use } from 'react';
import { useProtectPage } from '@/hooks/use-protect-page';

interface EditNoticePageProps { params: Promise<{ id: string }> }

export default function EditNoticePage({ params }: EditNoticePageProps) {
  useProtectPage();
  
  const { id } = use(params);
  const noticeId = parseInt(id);
  const { data, isLoading } = useSWR<any>(`/api/notices/${noticeId}`, apiGet);
  if (isLoading || !data) return <div className='p-6'>Loading...</div>;
  return <NoticeForm mode='edit' initial={data} />;
}


