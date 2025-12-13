"use client";

import { EmployeeForm } from "../../employee-form";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import type { Employee } from "@/types/employees";
import { useParams } from "next/navigation";
import { ROLES } from "@/config/roles";

export default function EditEmployeePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const {
    data: employee,
    isLoading,
    error,
  } = useSWR<Employee>(id ? `/api/employees/${id}` : null, apiGet);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading employee...</div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          {error ? "Failed to load employee" : "Employee not found"}
        </div>
      </div>
    );
  }

  // Map stored role code (e.g., TECHNICAL_DIRECTOR/TECHNICAL_DIRECTER) to a valid ROLES label
  function mapRoleToLabel(input?: string | null) {
    if (!input) return "";
    const roleValues = Object.values(ROLES) as string[]; // labels used by UI
    // If already an exact label
    if (roleValues.includes(input)) return input;
    // Normalize input code to label-ish format
    const normalizedLabel = String(input)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    // Try direct match after normalization
    if (roleValues.includes(normalizedLabel)) return normalizedLabel;
    // Fix common typos (e.g., Directer -> Director)
    const corrected = normalizedLabel.replace(/Directer/gi, "Director");
    if (roleValues.includes(corrected)) return corrected;
    // Fallback: match ignoring spaces/case
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const target = norm(normalizedLabel);
    const found = roleValues.find((r) => norm(r) === target);
    return found || "";
  }

  return (
    <EmployeeForm
      mode="edit"
      initial={{
        id: employee.id,
        name: employee.name,
        departmentId: employee.departmentId,
        siteEmployees: employee.siteEmployees,
        resignDate: employee.resignDate
          ? new Date(employee.resignDate as unknown as string).toISOString()
          : null,
        signatureImage: employee.signatureImage ?? null,
        employeeImage: employee.employeeImage ?? null,
        email: employee.user?.email,
        role: mapRoleToLabel(employee.user?.role),
        employeeDocuments: employee.employeeDocuments?.map((doc) => ({
          id: doc.id,
          documentName: doc.documentName,
          documentUrl: doc.documentUrl,
        })),
      }}
    />
  );
}
