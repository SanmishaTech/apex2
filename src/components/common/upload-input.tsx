import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AppButton } from './app-button';

export interface UploadInputProps {
  control: unknown; // relaxed typing like TextInput
  name: string; // field name that will hold File | null
  label: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  itemClassName?: string;
  maxSizeBytes?: number; // optional client-side validation
  onFileChange?: (file: File | null) => void;
  /** If true, show a tiny remove button when a file is selected */
  allowClear?: boolean;
}

/**
 * UploadInput - a controlled file picker integrated with RHF similar to TextInput styling.
 * Stores the selected File object in form state (single file). Provides basic size validation and file name display.
 */
export function UploadInput({ control, name, label, description, accept, disabled, required, className, itemClassName, maxSizeBytes, onFileChange, allowClear = true }: UploadInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function clearFile(onChange: (value: File | null) => void) {
    if (disabled) return;
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setError(null);
    onChange(null);
    onFileChange?.(null);
  }

  function validateSize(file: File) {
    if (maxSizeBytes && file.size > maxSizeBytes) {
      setError(`File exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB limit`);
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <FormField
      // @ts-expect-error relaxed typing like TextInput
      control={control}
      name={name}
  render={({ field: { onChange } }) => (
        <FormItem className={itemClassName}>
          <FormLabel>
            {label}{required ? <span className='ml-0.5 text-destructive'>*</span> : null}
          </FormLabel>
          <div className={cn('flex items-center gap-2', className)}>
            <input
              ref={inputRef}
              type='file'
              accept={accept}
              className='hidden'
              disabled={disabled}
              aria-required={required}
              onChange={e => {
                const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                if (!f) {
                  clearFile(onChange);
                  return;
                }
                if (!validateSize(f)) {
                  clearFile(onChange);
                  return;
                }
                setFileName(f.name);
                onChange(f);
                onFileChange?.(f);
              }}
            />
            <AppButton type='button' size='sm' onClick={pickFile} disabled={disabled}>{fileName ? 'Change' : 'Choose File'}</AppButton>
            <div className='text-xs text-muted-foreground truncate max-w-[14rem]' title={fileName}>{fileName || 'No file selected'}</div>
            {allowClear && fileName && (
              <button type='button' onClick={() => clearFile(onChange)} className='text-xs text-muted-foreground hover:text-foreground'>×</button>
            )}
          </div>
          {description ? <p className='text-xs text-muted-foreground mt-1'>{description}</p> : null}
          {error ? <p className='text-xs text-destructive mt-1'>{error}</p> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
