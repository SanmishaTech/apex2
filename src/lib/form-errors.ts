import { ZodIssue } from "zod";

export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  fieldErrors: FieldErrors;
  constructor(fieldErrors: FieldErrors, message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function zodIssuesToFieldErrors(issues: ZodIssue[] | any[]): FieldErrors {
  const map: FieldErrors = {};
  if (!Array.isArray(issues)) return map;
  for (const issue of issues) {
    const path = Array.isArray(issue?.path) && issue.path.length > 0 ? String(issue.path[0]) : undefined;
    if (!path) continue;
    if (!map[path]) {
      map[path] = String(issue?.message ?? "Invalid value");
    }
  }
  return map;
}

export async function handleApiErrorResponse(response: Response): Promise<never> {
  let data: any = undefined;
  try {
    data = await response.json();
  } catch {
    // ignore parse errors
  }
  const message = data?.message || `Request failed (${response.status})`;
  if (response.status === 400 && Array.isArray(data?.errors)) {
    const fieldErrors = zodIssuesToFieldErrors(data.errors);
    throw new ValidationError(fieldErrors, message);
  }
  throw new Error(message);
}
