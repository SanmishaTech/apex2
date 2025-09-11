"use client";

import { AppSelect } from '@/components/common';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';

interface Props {
  control: any;
  employeesData?: any; // expecting shape { data: Array<{ id: number, name: string }> }
}

const AIR_CLASSES = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const RAIL_CLASSES = [
  { value: '1A', label: '1A - First AC' },
  { value: '2A', label: '2A - Second AC' },
  { value: '3A', label: '3A - Third AC' },
  { value: 'SL', label: 'SL - Sleeper' },
  { value: 'CC', label: 'CC - Chair Car' },
  { value: '2S', label: '2S - Second Sitting' },
];

export default function TravelDetailsTab({ control, employeesData }: Props) {
  return (
    <>
      <FormSection legend='Travel Classes'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <AppSelect
            control={control}
            name='airTravelClass'
            label='Air Travel Class'
            triggerClassName='h-9 w-full'
            placeholder='Select air class'
          >
            {AIR_CLASSES.map(opt => (
              <AppSelect.Item key={opt.value} value={opt.value}>{opt.label}</AppSelect.Item>
            ))}
          </AppSelect>

          <AppSelect
            control={control}
            name='railwayTravelClass'
            label='Railway Travel Class'
            triggerClassName='h-9 w-full'
            placeholder='Select railway class'
          >
            {RAIL_CLASSES.map(opt => (
              <AppSelect.Item key={opt.value} value={opt.value}>{opt.label}</AppSelect.Item>
            ))}
          </AppSelect>
        </FormRow>

        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='busTravelClass'
            label='Bus Travel Class'
            placeholder='Enter bus travel class'
          />
          <div />
        </FormRow>
      </FormSection>

      <FormSection legend='Reporting'>
        <FormRow className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <AppSelect
            control={control}
            name='reporting1Id'
            label='Reporting 1'
            triggerClassName='h-9 w-full'
            placeholder='Select reporting manager 1'
          >
            {employeesData?.data?.map((emp: any) => (
              <AppSelect.Item key={emp.id} value={String(emp.id)}>
                {emp.name}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <AppSelect
            control={control}
            name='reporting2Id'
            label='Reporting 2'
            triggerClassName='h-9 w-full'
            placeholder='Select reporting manager 2'
          >
            {employeesData?.data?.map((emp: any) => (
              <AppSelect.Item key={emp.id} value={String(emp.id)}>
                {emp.name}
              </AppSelect.Item>
            ))}
          </AppSelect>
        </FormRow>
      </FormSection>
    </>
  );
}
