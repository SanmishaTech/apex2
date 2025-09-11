"use client";

import { AppSelect } from '@/components/common';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import type { DepartmentsResponse } from '@/types/departments';
import type { SitesResponse } from '@/types/sites';

interface Props {
  control: any;
  isCreate: boolean;
  departmentsData?: DepartmentsResponse;
  sitesData?: SitesResponse;
  onSignatureChange?: (file: File | null) => void;
  onProfilePicChange?: (file: File | null) => void;
}

export default function EmployeeDetailsTab({ control, isCreate, departmentsData, sitesData, onSignatureChange, onProfilePicChange }: Props) {
  return (
    <>
      <FormSection legend='Employee Information'>
        <FormRow cols={2}>
          <TextInput 
            control={control} 
            name='name' 
            label='Employee Name' 
            placeholder='Enter employee full name'
            required 
          />
          <div />
        </FormRow>
        <FormRow cols={2}>
          <AppSelect
            control={control}
            name='departmentId'
            label='Department'
            triggerClassName='h-9 w-full'
            placeholder='Select department'
          >
            {departmentsData?.data?.map(dept => (
              <AppSelect.Item key={dept.id} value={String(dept.id)}>
                {dept.department}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppSelect
            control={control}
            name='siteId'
            label='Site'
            triggerClassName='h-9 w-full'
            placeholder='Select site'
          >
            {sitesData?.data?.map(site => (
              <AppSelect.Item key={site.id} value={String(site.id)}>
                {site.site}
              </AppSelect.Item>
            ))}
          </AppSelect>
        </FormRow>
        <FormRow cols={2}>
          <TextInput
            control={control}
            name='resignDate'
            label='Resign Date'
            type='date'
            placeholder='Select resign date (optional)'
          />
          <div />
        </FormRow>
      </FormSection>

      {isCreate && (
        <FormSection legend='Login Details'>
          <FormRow cols={2}>
            <AppSelect
              control={control}
              name='role'
              label='Role'
              triggerClassName='h-9 w-full'
              placeholder='Select role'
            >
              <AppSelect.Item value='user'>User</AppSelect.Item>
              <AppSelect.Item value='admin'>Admin</AppSelect.Item>
              <AppSelect.Item value='project_user'>Project User</AppSelect.Item>
            </AppSelect>
            <TextInput
              control={control}
              name='email'
              label='Email'
              type='email'
              placeholder='Enter email address'
              required
            />
          </FormRow>
          <FormRow cols={2}>
            <TextInput
              control={control}
              name='password'
              label='Password'
              type='password'
              placeholder='Enter password (min 6 characters)'
              required
            />
            <TextInput
              control={control}
              name='confirmPassword'
              label='Verify Password'
              type='password'
              placeholder='Re-enter password'
              required
            />
          </FormRow>
        </FormSection>
      )}

      {isCreate && (
        <FormSection legend='Upload Signature / Profile Pic'>
          <FormRow cols={2}>
            <div>
              <label className='block text-sm font-medium mb-2'>Signature</label>
              <input
                type='file'
                accept='image/*'
                onChange={(e) => onSignatureChange?.(e.target.files?.[0] || null)}
                className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-2'>Profile Pic</label>
              <input
                type='file'
                accept='image/*'
                onChange={(e) => onProfilePicChange?.(e.target.files?.[0] || null)}
                className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              />
            </div>
          </FormRow>
        </FormSection>
      )}
    </>
  );
}
