'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserNav } from '@/components/layout/user-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useProtectPage } from '@/hooks/use-protect-page';

// user fetching handled by useCurrentUser hook

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [mobileOpen, setMobileOpen] = useState(false); // small screens overlay
	const [sidebarVisible, setSidebarVisible] = useState(true); // desktop collapse
	const { user, isLoading } = useCurrentUser();
	const { loading, allowed } = useProtectPage();

	// Show skeleton layout immediately while loading user data
	if (isLoading || loading) {
		return (
			<div className='flex min-h-screen w-full relative z-0'>
				<div className='hidden md:flex w-64 flex-col border-r bg-gradient-to-b from-background to-background/80 backdrop-blur-sm shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] relative'>
					<div className="h-14 flex items-center px-4 font-semibold tracking-tight animate-pulse">
						<div className="h-8 w-8 bg-muted rounded-md"></div>
						<div className="ml-3 h-4 w-16 bg-muted rounded"></div>
					</div>
					<div className="flex-1 p-4 space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="h-8 bg-muted rounded animate-pulse"></div>
						))}
					</div>
				</div>
				<div className='flex flex-1 flex-col min-w-0 md:ml-64'>
					<header className='sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/80 backdrop-blur shadow-sm px-4'>
						<div className="h-6 w-24 bg-muted rounded animate-pulse"></div>
					</header>
					<main className='flex-1 px-3 py-4'>
						<div className='mx-auto w-full space-y-4'>
							<div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
							<div className="h-64 bg-muted rounded animate-pulse"></div>
						</div>
					</main>
				</div>
			</div>
		);
	}

	if (!user || !allowed) {
		return (
			<div className='flex items-center justify-center h-screen'>
				<div className='text-muted-foreground'>Access denied</div>
			</div>
		);
	}

	return (
		<div className='flex min-h-screen w-full relative z-0'>
				<Sidebar
					fixed
					className={
						sidebarVisible
							? 'transition-transform duration-200'
							: 'transition-transform duration-200 md:-translate-x-full'
					}
				/>
				{/* Mobile sidebar (temporary) */}
					{mobileOpen && (
						<div className='fixed inset-0 z-40 flex md:hidden'>
							<div
								className='absolute inset-0 bg-background/80 backdrop-blur-sm'
								onClick={() => setMobileOpen(false)}
							/>
							<div className='relative z-50 w-64 border-r bg-background'>
								<Sidebar mobile onNavigate={() => setMobileOpen(false)} />
							</div>
						</div>
					)}
				<div
					className={`flex flex-1 flex-col min-w-0 transition-[margin-left] duration-200 ${
						sidebarVisible ? 'md:ml-64' : 'md:ml-0'
					}`}
				>
					{/* Decorative gradient edge overlay to blend content area */}
					<div className='pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(circle_at_center,black_60%,transparent_100%)]' />
					<header className='sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65 shadow-sm ring-1 ring-border/50 px-4'>
						{/* Mobile toggle */}
						<Button
							variant='outline'
							size='icon'
							onClick={() => setMobileOpen((o) => !o)}
							className='md:hidden'
						>
							<Menu className='h-5 w-5' />
							<span className='sr-only'>Toggle navigation</span>
						</Button>
						{/* Desktop toggle */}
						<Button
							variant='outline'
							size='icon'
							onClick={() => setSidebarVisible((v) => !v)}
							className='hidden md:inline-flex'
						>
							<Menu className='h-5 w-5 transition-transform duration-200' />
							<span className='sr-only'>
								{sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
							</span>
						</Button>
						<div className='flex-1 truncate font-semibold tracking-tight'>
							Dashboard
						</div>
						<div className='flex items-center gap-2'>
							<ThemeToggle />
							<UserNav />
						</div>
					</header>
					<main className='flex-1 px-3 py-4 overflow-y-auto backdrop-blur-[1px] min-w-0'>
						<div className='mx-auto w-full relative z-10 min-w-0'>
							{children}
						</div>
					</main>
				</div>
			</div>
	);
}
