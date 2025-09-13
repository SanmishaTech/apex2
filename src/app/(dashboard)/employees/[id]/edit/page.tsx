'use client';

import { EmployeeForm } from '../../employee-form';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import type { Employee } from '@/types/employees';
import { useParams } from 'next/navigation';

export default function EditEmployeePage() {
	const params = useParams();
	const id = params.id as string;

	const { data: employee, isLoading, error } = useSWR<Employee>(
		id ? `/api/employees/${id}` : null,
		apiGet
	);

	if (isLoading) {
		return (
			<div className="p-6">
				<div className="text-center">Loading employee...</div>
			</div>
		);
	}

	if (error || !employee) {
		return (
			<div className="p-6">
				<div className="text-center text-destructive">
					{error ? 'Failed to load employee' : 'Employee not found'}
				</div>
			</div>
		);
	}

	return (
		<EmployeeForm
			mode="edit"
			initial={{
				id: employee.id,
				name: employee.name,
				departmentId: employee.departmentId,
				siteId: employee.siteId,
				resignDate: employee.resignDate ? new Date(employee.resignDate as unknown as string).toISOString() : null,
			}}
		/>
	);
}
