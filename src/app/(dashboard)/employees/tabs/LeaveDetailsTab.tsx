"use client";

import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';

interface Props {
  control: any;
}

export default function LeaveDetailsTab({ control }: Props) {
  return (
    <>
      <FormSection legend='Annual Leave Allocation'>
        <FormRow className="grid grid-cols-2 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='sickLeavesPerYear'
            label='Sick Leaves Per Year'
            type='number'
            placeholder='Enter sick leaves per year'
          />
          <TextInput
            control={control}
            name='paidLeavesPerYear'
            label='Paid Leaves Per Year'
            type='number'
            placeholder='Enter paid leaves per year'
          />
        </FormRow>
        <FormRow className="grid grid-cols-2 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='casualLeavesPerYear'
            label='Casual Leaves Per Year'
            type='number'
            placeholder='Enter casual leaves per year'
          />
          <div />
        </FormRow>
      </FormSection>

      <FormSection legend='Current Leave Balance'>
        <FormRow className="grid grid-cols-2 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='balanceSickLeaves'
            label='Balance Sick Leaves'
            type='number'
            placeholder='Enter current sick leave balance'
          />
          <TextInput
            control={control}
            name='balancePaidLeaves'
            label='Balance Paid Leaves'
            type='number'
            placeholder='Enter current paid leave balance'
          />
        </FormRow>
        <FormRow className="grid grid-cols-2 sm:grid-cols-2 gap-6 items-start">
          <TextInput
            control={control}
            name='balanceCasualLeaves'
            label='Balance Casual Leaves'
            type='number'
            placeholder='Enter current casual leave balance'
          />
          <div />
        </FormRow>
      </FormSection>
    </>
  );
}
