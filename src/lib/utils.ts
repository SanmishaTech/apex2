// Misc utilities: password strength heuristic + Tailwind class merger (cn).
// Keep small, pure helpers here; move larger domain logic into dedicated modules.
// Password strength meter utility
export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  // Simple scoring: length, variety, common patterns
  let score = 0;
  if (!password) return { score, label: 'Empty', color: 'bg-gray-200' };
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  let label = 'Weak', color = 'bg-red-400';
  if (score >= 5) { label = 'Strong'; color = 'bg-green-500'; }
  else if (score >= 3) { label = 'Medium'; color = 'bg-yellow-400'; }
  return { score, label, color };
}
import { type ClassValue } from "clsx";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
