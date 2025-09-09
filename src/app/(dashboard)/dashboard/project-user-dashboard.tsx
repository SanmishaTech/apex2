'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { useCurrentUser } from '@/hooks/use-current-user';

interface ProjectSummary {
	id: number;
	name: string;
	clientName: string;
	location: string | null;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	_count: { users: number; files: number };
}
interface ProjectListResponse {
	data: ProjectSummary[];
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
}
interface ProjectFile {
	id: number;
	originalName: string;
	title: string;
	filename: string;
	mimeType: string;
	size: number;
	createdAt: string;
}

export function ProjectUserDashboard() {
	const { user } = useCurrentUser();
	const router = useRouter();
	const [project, setProject] = useState<ProjectSummary | null>(null);
	const [files, setFiles] = useState<ProjectFile[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!user || user.role !== 'project_user') return;
		let abort = false;
		(async () => {
			setLoading(true);
			setError(null);
			setProject(null);
			setFiles([]);
			try {
				// Fetch membership projects (page size 5 just in case multiple later)
				const res = await apiGet<ProjectListResponse>(
					`/api/projects?page=1&perPage=5`
				);
				const first = res.data?.[0];
				if (!first) {
					if (!abort)
						setError(
							'No project assigned to your account. Please contact support.'
						);
					return;
				}
				if (!abort) setProject(first);
				try {
					const filesRes = await apiGet<ProjectFile[]>(
						`/api/project-files?projectId=${first.id}`
					);
					if (!abort) setFiles(filesRes);
				} catch {
					if (!abort) setError('Project loaded but files failed to load');
				}
			} catch (e) {
				if (!abort) setError((e as Error).message || 'Failed to load project');
			} finally {
				if (!abort) setLoading(false);
			}
		})();
		return () => {
			abort = true;
		};
	}, [user]);

	if (!user || user.role !== 'project_user') return null;
	return (
		<div className='w-full max-w-5xl mx-auto p-4 space-y-4'>
			<h1 className='text-xl font-semibold'>Project Overview</h1>
			{loading && (
				<div className='text-sm text-muted-foreground'>Loading...</div>
			)}
			{error && (
				<div className='text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded p-2 w-full'>
					{error}
				</div>
			)}
			{!error && project && (
				<AppCard>
					<AppCard.Header>
						<AppCard.Title>{project.name}</AppCard.Title>
						<AppCard.Description>{project.clientName}</AppCard.Description>
						<AppCard.Action>
							<AppButton
								size='sm'
								onClick={() => router.push(`/projects/${project.id}/cracks`)}
							>
								View Details
							</AppButton>
						</AppCard.Action>
					</AppCard.Header>
					<AppCard.Content className='space-y-4'>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
							<div>
								<span className='font-medium'>Location:</span>{' '}
								{project.location || '-'}
							</div>
							<div>
								<span className='font-medium'>Files:</span>{' '}
								{project._count.files}
							</div>
							<div className='md:col-span-2'>
								<span className='font-medium'>Description:</span>{' '}
								{project.description || '-'}
							</div>
						</div>
						<div>
							<h2 className='font-medium mb-2 text-sm'>Attached Files</h2>
							{files.length ? (
								<div className='border rounded overflow-hidden'>
									<table className='w-full text-xs md:text-sm'>
										<thead className='bg-muted/50'>
											<tr>
												<th className='px-2 py-1 text-left'>Title</th>
												<th className='px-2 py-1 text-left'>Original Name</th>
												<th className='px-2 py-1 text-left'>Type</th>
												<th className='px-2 py-1 text-right'>Size (KB)</th>
												<th className='px-2 py-1 text-left'>Actions</th>
											</tr>
										</thead>
										<tbody>
											{files.map((f) => (
												<tr key={f.id} className='border-t hover:bg-muted/30'>
													<td className='px-2 py-1 whitespace-nowrap'>
														{f.title}
													</td>
													<td className='px-2 py-1 whitespace-nowrap'>
														{f.originalName}
													</td>
													<td className='px-2 py-1 whitespace-nowrap'>
														{f.mimeType.split('/').pop()}
													</td>
													<td className='px-2 py-1 text-right'>
														{(f.size / 1024).toFixed(1)}
													</td>
													<td className='px-2 py-1'>
														<AppButton
															size='sm'
															variant='secondary'
															onClick={() =>
																window.open(
																	`/api/project-files/${f.id}/download`,
																	'_blank'
																)
															}
														>
															Open
														</AppButton>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<div className='text-xs text-muted-foreground'>No files.</div>
							)}
						</div>
					</AppCard.Content>
				</AppCard>
			)}
			{!loading && !project && !error && (
				<div className='text-sm text-muted-foreground'>
					No project data available.
				</div>
			)}
		</div>
	);
}
