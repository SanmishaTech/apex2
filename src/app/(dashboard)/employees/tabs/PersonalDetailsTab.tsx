"use client";

import { AppSelect } from '@/components/common';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import type { StatesResponse } from '@/types/states';
import type { CitiesResponse } from '@/types/cities';

interface Props {
  control: any;
  statesData?: StatesResponse;
  citiesData?: CitiesResponse;
}

export default function PersonalDetailsTab({ control, statesData, citiesData }: Props) {
  return (
    <>
      <FormSection legend='Personal Information'>
        <FormRow
          cols={2}
          smCols={2}
          mdCols={2}
          lgCols={2}
          from='lg'
        className="grid grid-cols-2 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='dateOfBirth'
            label='Date of Birth'
            type='date'
            placeholder='Select date of birth'
          />
          <TextInput
            control={control}
            name='anniversaryDate'
            label='Anniversary Date'
            type='date'
            placeholder='Select anniversary date'
          />
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='spouseName'
            label='Spouse Name'
            placeholder='Enter spouse name'
          />
          <TextInput
            control={control}
            name='bloodGroup'
            label='Blood Group'
            placeholder='Enter blood group'
          />
        </FormRow>
      </FormSection>

      <FormSection legend='Address Details'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='correspondenceAddress'
            label='Correspondence Address'
            placeholder='Enter correspondence address'
          />
          <TextInput
            control={control}
            name='permanentAddress'
            label='Permanent Address'
            placeholder='Enter permanent address'
          />
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <AppSelect
            control={control}
            name='stateId'
            label='State'
            triggerClassName='h-9 w-full'
            placeholder='Select state'
          >
            {statesData?.data?.map((state) => (
              <AppSelect.Item key={state.id} value={String(state.id)}>
                {state.state}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppSelect
            control={control}
            name='cityId'
            label='City'
            triggerClassName='h-9 w-full'
            placeholder='Select city'
          >
            {citiesData?.data?.map((city) => (
              <AppSelect.Item key={city.id} value={String(city.id)}>
                {city.city}
              </AppSelect.Item>
            ))}
          </AppSelect>
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='pincode'
            label='Pincode'
            placeholder='Enter pin code'
          />
          <div />
        </FormRow>
      </FormSection>

      <FormSection legend='Emergency Contact'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='emergencyContactPerson'
            label='Contact Person'
            placeholder='Enter contact person name'
          />
          <TextInput
            control={control}
            name='emergencyContactNo'
            label='Contact No'
            placeholder='Enter contact number'
          />
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='emergencyContactRelation'
            label='Relation'
            placeholder='Enter relation with employee'
          />
          <div />
        </FormRow>
      </FormSection>

      <FormSection legend='Contact Detail'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='mobile1'
            label='Mobile 1'
            placeholder='Enter primary mobile number'
          />
          <TextInput
            control={control}
            name='mobile2'
            label='Mobile 2'
            placeholder='Enter secondary mobile number'
          />
        </FormRow>
      </FormSection>

      <FormSection legend='Other Detail'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='esic'
            label='ESIC'
            placeholder='Enter ESIC number'
          />
          <TextInput
            control={control}
            name='pf'
            label='PF'
            placeholder='Enter PF number'
          />
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='panNo'
            label='PAN No'
            placeholder='Enter PAN number'
          />
          <TextInput
            control={control}
            name='adharNo'
            label='ADHAR No'
            placeholder='Enter Aadhar number'
          />
        </FormRow>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='cinNo'
            label='CIN No'
            placeholder='Enter CIN number'
          />
          <div />
        </FormRow>
      </FormSection>
    </>
  );
}
