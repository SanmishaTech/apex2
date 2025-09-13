'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { AppButton } from '@/components/common/app-button';
import { toast } from '@/lib/toast';
import { apiPost, apiPatch } from '@/lib/api-client';
import Image from 'next/image';

export interface NoticeInitialData {
  id?: number;
  noticeHead?: string;
  noticeHeading?: string;
  noticeDescription?: string | null;
  documentUrl?: string | null;
}

export function NoticeForm({ mode, initial, redirectOnSuccess = '/notices' }: { mode: 'create' | 'edit'; initial?: NoticeInitialData | null; redirectOnSuccess?: string; }) {
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.documentUrl || null);

  const schema = z.object({
    noticeHead: z.string().min(1, 'Required'),
    noticeHeading: z.string().min(1, 'Required'),
    noticeDescription: z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      noticeHead: initial?.noticeHead || '',
      noticeHeading: initial?.noticeHeading || '',
      noticeDescription: initial?.noticeDescription || '',
    },
  });
  const { control, handleSubmit } = form;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f && f.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('noticeHead', values.noticeHead);
        fd.append('noticeHeading', values.noticeHeading);
        if (values.noticeDescription) fd.append('noticeDescription', values.noticeDescription);
        fd.append('document', file);
        const endpoint = mode === 'create' ? '/api/notices' : `/api/notices/${initial?.id}`;
        const res = await fetch(endpoint, { method: mode === 'create' ? 'POST' : 'PATCH', body: fd });
        if (!res.ok) throw new Error((await res.json()).message || 'Failed');
      } else {
        const payload = {
          noticeHead: values.noticeHead,
          noticeHeading: values.noticeHeading,
          noticeDescription: values.noticeDescription || null,
        };
        if (mode === 'create') await apiPost('/api/notices', payload);
        else await apiPatch(`/api/notices/${initial?.id}`, payload);
      }
      toast.success(mode === 'create' ? 'Notice created' : 'Notice updated');
      window.location.href = redirectOnSuccess;
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{mode === 'create' ? 'Create Notice' : 'Edit Notice'}</AppCard.Title>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend={<span>General</span>}>
              <FormRow cols={3} from='md'>
                <TextInput control={control} name='noticeHead' label='Notice Head' placeholder='Head' />
                <TextInput control={control} name='noticeHeading' label='Notice Heading' placeholder='Heading' />
                <TextInput control={control} name='noticeDescription' label='Description' placeholder='Description' />
              </FormRow>
            </FormSection>

            <FormSection legend={<span>Document</span>}>
              <FormRow>
                <div>
                  <label className='text-sm font-medium'>Upload Document</label>
                  <input type='file' onChange={onFileChange} className='mt-2 block text-sm' />
                  {previewUrl ? (
                    <div className='mt-3'>
                      <Image src={previewUrl} alt='Preview' width={200} height={120} className='rounded border' />
                    </div>
                  ) : initial?.documentUrl ? (
                    <div className='mt-2 text-xs text-muted-foreground'>Existing: {initial.documentUrl}</div>
                  ) : null}
                </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer>
            <AppButton type='submit' isLoading={submitting}>{mode === 'create' ? 'Create' : 'Update'}</AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default NoticeForm;


