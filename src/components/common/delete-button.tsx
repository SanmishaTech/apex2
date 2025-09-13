"use client";
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DeleteIconButton } from '@/components/common/icon-button';
import React from 'react';

export type DeleteButtonProps = {
  onDelete: () => Promise<void> | void;
  itemLabel?: string; // e.g. "user", will be used in dialog title if provided
  title?: string; // override dialog title
  description?: string; // override description
  confirmText?: string;
  cancelText?: string;
  className?: string; // class for trigger button
  size?: 'xs' | 'sm' | 'md';
  children?: React.ReactNode; // custom trigger content
};

export function DeleteButton({
  onDelete,
  itemLabel,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  className,
  size = 'sm',
  children,
}: DeleteButtonProps) {
  const dialogTitle = title || `Delete ${itemLabel || 'item'}?`;
  const dialogDescription = description || `Are you sure you want to permanently delete this ${itemLabel || 'item'}? This action cannot be undone.`;

  return (
    <ConfirmDialog
  trigger={children || <DeleteIconButton size={size} className={className} />}
      title={dialogTitle}
      description={dialogDescription}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={onDelete}
    />
  );
}
