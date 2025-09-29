import { cn } from '@/lib/utils';
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectInputProps {
	control: unknown; // relaxed typing
	name: string;
	label: string;
	description?: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	options: SelectOption[];
	required?: boolean;
	/** Optional class for the outer FormItem wrapper (useful for grid spans) */
	itemClassName?: string;
	/** Optional 1-12 column span at lg breakpoint (requires parent FormRow with cols>=span). */
	span?: number;
	/** Breakpoint from which the span should apply (default 'lg'). */
	spanFrom?: 'md' | 'lg';
}

export function SelectInput({
	control,
	name,
	label,
	description,
	placeholder,
	disabled,
	className,
	options,
	required,
	itemClassName,
	span,
	spanFrom = 'lg',
}: SelectInputProps) {
	// Grid span classes
	const MAP_MD: Record<number, string> = {
		1: 'md:col-span-1',
		2: 'md:col-span-2',
		3: 'md:col-span-3',
		4: 'md:col-span-4',
		5: 'md:col-span-5',
		6: 'md:col-span-6',
		7: 'md:col-span-7',
		8: 'md:col-span-8',
		9: 'md:col-span-9',
		10: 'md:col-span-10',
		11: 'md:col-span-11',
		12: 'md:col-span-12',
	};
	const MAP_LG: Record<number, string> = {
		1: 'lg:col-span-1',
		2: 'lg:col-span-2',
		3: 'lg:col-span-3',
		4: 'lg:col-span-4',
		5: 'lg:col-span-5',
		6: 'lg:col-span-6',
		7: 'lg:col-span-7',
		8: 'lg:col-span-8',
		9: 'lg:col-span-9',
		10: 'lg:col-span-10',
		11: 'lg:col-span-11',
		12: 'lg:col-span-12',
	};
	const spanMap = spanFrom === 'md' ? MAP_MD : MAP_LG;
	const spanClass = span && span >= 1 && span <= 12 ? spanMap[span] : undefined;

	return (
		<FormField
			// @ts-expect-error relaxed typing for generic use
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn('col-span-12', spanClass, itemClassName)}>
					<FormLabel>
						{label}
						{required ? (
							<span className='ml-0.5 text-destructive'>*</span>
						) : null}
					</FormLabel>
					<Select
						onValueChange={field.onChange}
						defaultValue={field.value}
						disabled={disabled}
					>
						<FormControl>
							<SelectTrigger className={cn('w-full', className)}>
								<SelectValue placeholder={placeholder} />
							</SelectTrigger>
						</FormControl>
						<SelectContent>
							{options.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
									disabled={option.disabled}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{description && (
						<p className="text-[11px] text-muted-foreground">{description}</p>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
