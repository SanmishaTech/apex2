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
  const { data, isLoading, error, mutate } = useSWR<any>(`/api/notices/${noticeId}`, apiGet);
  
  if (error) {
    return <div className="p-6 text-center text-muted-foreground">Failed to load notice. Please try again.</div>;
  }

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return <NoticeForm mode="edit" initial={data} mutate={mutate} />;
}