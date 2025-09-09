import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type EmailInputProps = {
  control: unknown; // relaxed typing to avoid strict RHF generics
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  required?: boolean;
  span?: number;
  spanFrom?: 'md' | 'lg';
};

export function EmailInput({ control, name, label, description, placeholder, disabled, autoComplete = 'email', className, required, span, spanFrom='lg' }: EmailInputProps) {
  const MAP_MD: Record<number,string> = {1:'md:col-span-1',2:'md:col-span-2',3:'md:col-span-3',4:'md:col-span-4',5:'md:col-span-5',6:'md:col-span-6',7:'md:col-span-7',8:'md:col-span-8',9:'md:col-span-9',10:'md:col-span-10',11:'md:col-span-11',12:'md:col-span-12'};
  const MAP_LG: Record<number,string> = {1:'lg:col-span-1',2:'lg:col-span-2',3:'lg:col-span-3',4:'lg:col-span-4',5:'lg:col-span-5',6:'lg:col-span-6',7:'lg:col-span-7',8:'lg:col-span-8',9:'lg:col-span-9',10:'lg:col-span-10',11:'lg:col-span-11',12:'lg:col-span-12'};
  const spanMap = spanFrom === 'md' ? MAP_MD : MAP_LG;
  const spanClass = span && span>=1 && span<=12 ? spanMap[span] : undefined;
  return (
    <FormField
      // @ts-expect-error relaxed typing
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('col-span-12', spanClass)}>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </FormLabel>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <Mail className="h-4 w-4" />
            </div>
            <FormControl>
              <Input
                type="email"
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                className={cn('pl-9', className)}
                required={required}
                {...field}
              />
            </FormControl>
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
