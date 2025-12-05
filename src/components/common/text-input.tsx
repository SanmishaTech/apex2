import { cn } from '@/lib/utils';
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export interface TextInputProps {
	control: unknown; // relaxed typing
	name: string;
	label?: string;
	min?: number;
	max?: number;
	maxLength?: number;
	type?: string;
	description?: string;
	placeholder?: string;
	disabled?: boolean;
	autoComplete?: string;
	className?: string;
	required?: boolean;
	prefixIcon?: React.ReactNode;
	pattern?: string;
	onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
	step?: number | string;
	/** Optional class for the outer FormItem wrapper (useful for grid spans) */
	itemClassName?: string;
	/** Optional 1-12 column span at lg breakpoint (requires parent FormRow with cols>=span). */
	span?: number;
	/** Breakpoint from which the span should apply (default 'lg'). */
	spanFrom?: 'md' | 'lg';
}

export function TextInput({
	control,
	name,
	label,
	min,
	max,
	maxLength,
	type = 'text',
	description,
	placeholder,
	disabled,
	autoComplete,
	className,
	required,
	prefixIcon,
	pattern,
	onInput,
	step,
	itemClassName,
	span,
	spanFrom = 'lg',
}: TextInputProps) {
	// Map span number to a literal Tailwind class so JIT picks it up (avoid dynamic string that purge might miss)
	const MAP_MD: Record<number,string> = {
		1:'md:col-span-1',2:'md:col-span-2',3:'md:col-span-3',4:'md:col-span-4',5:'md:col-span-5',6:'md:col-span-6',7:'md:col-span-7',8:'md:col-span-8',9:'md:col-span-9',10:'md:col-span-10',11:'md:col-span-11',12:'md:col-span-12'
	};
	const MAP_LG: Record<number,string> = {
		1:'lg:col-span-1',2:'lg:col-span-2',3:'lg:col-span-3',4:'lg:col-span-4',5:'lg:col-span-5',6:'lg:col-span-6',7:'lg:col-span-7',8:'lg:col-span-8',9:'lg:col-span-9',10:'lg:col-span-10',11:'lg:col-span-11',12:'lg:col-span-12'
	};
	const spanMap = spanFrom === 'md' ? MAP_MD : MAP_LG;
	const spanClass = span && span >= 1 && span <= 12 ? spanMap[span] : undefined;
	return (
		<FormField
			// @ts-expect-error relaxed typing for generic use
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn('col-span-12', itemClassName, spanClass)}>
					{label !== undefined ? (
						<FormLabel>
							{label}
							{required ? (
								<span className='ml-0.5 text-destructive'>*</span>
							) : null}
						</FormLabel>
					) : null}
					<div className='relative'>
						{prefixIcon && (
							<div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground'>
								{prefixIcon}
							</div>
						)}
						<FormControl>
							<Input
								type={type}
								placeholder={placeholder}
								autoComplete={autoComplete}
								disabled={disabled}
								min={min}
								max={max}
								maxLength={maxLength}
								pattern={pattern}
								onInput={onInput}
								step={step as any}
								className={cn(prefixIcon && 'pl-9', className)}
								required={required}
								{...field}
								value={field.value ?? ''}
							/>
						</FormControl>
					</div>
					{description ? (
						<p className='text-xs text-muted-foreground mt-1'>{description}</p>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
