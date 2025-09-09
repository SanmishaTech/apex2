import * as React from 'react';
import { Card, CardHeader as BaseCardHeader, CardTitle, CardDescription, CardAction as BaseCardAction, CardContent as BaseCardContent, CardFooter as BaseCardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Simplified AppCard: purely compositional wrapper identical to shadcn Card.
const AppCardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseCardHeader>>(function AppCardHeader({ className, ...rest }, ref) {
	return <BaseCardHeader ref={ref} className={cn('p-4 border-b', className)} {...rest} />;
});

const AppCardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseCardAction>>(function AppCardAction({ className, ...rest }, ref) {
	return <BaseCardAction ref={ref} className={cn('p-4 pt-4 md:pt-4 md:p-4 ml-auto', className)} {...rest} />;
});

const AppCardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseCardContent>>(function AppCardContent({ className, ...rest }, ref) {
	return <BaseCardContent ref={ref} className={cn('p-4 space-y-4', className)} {...rest} />;
});

const AppCardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseCardFooter>>(function AppCardFooter({ className, ...rest }, ref) {
	return <BaseCardFooter ref={ref} className={cn('p-4 border-t gap-2', className)} {...rest} />;
});

const BaseAppCard = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Card>>(function AppCard({ className, ...rest }, ref) {
	// Override default gap-6 from base Card with gap-4 (last class wins in Tailwind)
	return <Card ref={ref} className={cn('gap-4 py-2 rounded-lg', className)} {...rest} />;
});

export type AppCardComponent = typeof BaseAppCard & {
		Header: typeof AppCardHeader;
	Title: typeof CardTitle;
	Description: typeof CardDescription;
	Action: typeof AppCardAction;
	Content: typeof AppCardContent;
	Footer: typeof AppCardFooter;
};

export const AppCard = Object.assign(BaseAppCard, {
		Header: AppCardHeader,
	Title: CardTitle,
	Description: CardDescription,
	Action: AppCardAction,
	Content: AppCardContent,
	Footer: AppCardFooter,
}) as AppCardComponent;
