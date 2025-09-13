"use client";

import { AppSelect } from '@/components/common';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import type { SitesResponse } from '@/types/sites';

interface Props {
  control: any;
  sitesData?: SitesResponse;
}

export default function ReportingSitesTab({ control, sitesData }: Props) {
  return (
    <>
      <FormSection legend='Reporting Sites'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <AppSelect
            control={control}
            name='reportingSiteId'
            label='Site'
            triggerClassName='h-9 w-full'
            placeholder='Select a site'
          >
            {sitesData?.data?.map((site) => (
              <AppSelect.Item key={site.id} value={String(site.id)}>
                {site.site}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <TextInput
            control={control}
            name='reportingSiteAssignedDate'
            label='Assigned Date'
            type='date'
            placeholder='Select assigned date'
          />
        </FormRow>
      </FormSection>
    </>
  );
}
