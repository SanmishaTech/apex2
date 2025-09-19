'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { ImprovedUploadInput } from '@/components/common/improved-upload-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { AppButton } from '@/components/common/app-button';
import { toast } from '@/lib/toast';
import { apiPost, apiPatch } from '@/lib/api-client';

export interface NoticeInitialData {
  id?: number;
  noticeHead?: string;
  noticeHeading?: string;
  noticeDescription?: string | null;
  documentUrl?: string | null;
}

export function ImprovedNoticeForm({ 
  mode, 
  initial, 
  redirectOnSuccess = '/notices' 
}: { 
  mode: 'create' | 'edit'; 
  initial?: NoticeInitialData | null; 
  redirectOnSuccess?: string; 
}) {
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    noticeHead: z.string().min(1, 'Required'),
    noticeHeading: z.string().min(1, 'Required'),
    noticeDescription: z.string().optional(),
    documentUrl: z.string().nullable().optional(),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      noticeHead: initial?.noticeHead || '',
      noticeHeading: initial?.noticeHeading || '',
      noticeDescription: initial?.noticeDescription || '',
      documentUrl: initial?.documentUrl || null,
    },
  });
  const { control, handleSubmit } = form;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        noticeHead: values.noticeHead,
        noticeHeading: values.noticeHeading,
        noticeDescription: values.noticeDescription || null,
        documentUrl: values.documentUrl,
      };
      
      if (mode === 'create') {
        await apiPost('/api/notices', payload);
      } else {
        await apiPatch(`/api/notices/${initial?.id}`, payload);
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
          <AppCard.Title>
            {mode === 'create' ? 'Create Notice (Improved)' : 'Edit Notice (Improved)'}
          </AppCard.Title>
          <AppCard.Description>
            Uses the new centralized upload system with automatic file serving
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend={<span>General Information</span>}>
              <FormRow cols={2} from="md">
                <TextInput 
                  control={control} 
                  name="noticeHead" 
                  label="Notice Head" 
                  placeholder="Enter notice head" 
                  required
                />
                <TextInput 
                  control={control} 
                  name="noticeHeading" 
                  label="Notice Heading" 
                  placeholder="Enter notice heading" 
                  required
                />
              </FormRow>
              <FormRow>
                <TextInput 
                  control={control} 
                  name="noticeDescription" 
                  label="Description" 
                  placeholder="Enter description (optional)" 
                />
              </FormRow>
            </FormSection>

            <FormSection legend={<span>Document</span>}>
              <FormRow>
                <ImprovedUploadInput
                  control={control}
                  name="documentUrl"
                  label="Upload Document"
                  description="Upload an image or document file. Files are automatically processed and served via API."
                  type="document"
                  prefix="notice"
                  showPreview={true}
                  existingUrl={initial?.documentUrl}
                  onFileUploaded={(url, filename) => {
                    console.log('File uploaded:', { url, filename });
                  }}
                />
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer>
            <AppButton type="submit" isLoading={submitting}>
              {mode === 'create' ? 'Create Notice' : 'Update Notice'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default ImprovedNoticeForm;