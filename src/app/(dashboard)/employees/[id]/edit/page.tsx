"use client";

import { EmployeeForm } from "../../employee-form";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import type { Employee } from "@/types/employees";
import { useParams } from "next/navigation";

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

  return (
    <EmployeeForm
      mode="edit"
      initial={{
        id: employee.id,
        name: employee.name,
        designationId: employee.designationId ?? null,
        previousWorkExperience: employee.previousWorkExperience ?? null,
        departmentId: employee.departmentId,
        siteEmployees: employee.siteEmployees,
        joinDate: employee.joinDate
          ? new Date(employee.joinDate as unknown as string).toISOString()
          : null,
        resignDate: employee.resignDate
          ? new Date(employee.resignDate as unknown as string).toISOString()
          : null,
        signatureImage: employee.signatureImage ?? null,
        employeeImage: employee.employeeImage ?? null,
        // Personal Details
        dateOfBirth: employee.dateOfBirth
          ? new Date(employee.dateOfBirth as unknown as string).toISOString()
          : null,
        anniversaryDate: employee.anniversaryDate
          ? new Date(
              employee.anniversaryDate as unknown as string
            ).toISOString()
          : null,
        spouseName: employee.spouseName ?? null,
        bloodGroup: employee.bloodGroup ?? null,
        // Address Details
        correspondenceAddress: employee.correspondenceAddress ?? null,
        permanentAddress: employee.permanentAddress ?? null,
        stateId: employee.stateId ?? null,
        cityId: employee.cityId ?? null,
        pincode: employee.pincode ?? null,
        // Contact Details
        mobile1: employee.mobile1 ?? null,
        mobile2: employee.mobile2 ?? null,
        emergencyContactPerson: employee.emergencyContactPerson ?? null,
        emergencyContactNo: employee.emergencyContactNo ?? null,
        emergencyContactRelation: employee.emergencyContactRelation ?? null,
        // Other Details
        esic: employee.esic ?? null,
        pf: employee.pf ?? null,
        panNo: employee.panNo ?? null,
        adharNo: employee.adharNo ?? null,
        cinNo: employee.cinNo ?? null,
        // Travel/Reporting Details
        airTravelClass: employee.airTravelClass ?? null,
        railwayTravelClass: employee.railwayTravelClass ?? null,
        busTravelClass: employee.busTravelClass ?? null,
        reporting1Id: (employee as any).reporting1Id ?? null,
        reporting2Id: (employee as any).reporting2Id ?? null,
        reportingSiteId: (employee as any).reportingSiteId ?? null,
        reportingSiteAssignedDate: (employee as any).reportingSiteAssignedDate
          ? new Date(
              (employee as any).reportingSiteAssignedDate as unknown as string
            ).toISOString()
          : null,
        // Leave Details
        sickLeavesPerYear: (employee as any).sickLeavesPerYear ?? null,
        paidLeavesPerYear: (employee as any).paidLeavesPerYear ?? null,
        casualLeavesPerYear: (employee as any).casualLeavesPerYear ?? null,
        balanceSickLeaves: (employee as any).balanceSickLeaves ?? null,
        balancePaidLeaves: (employee as any).balancePaidLeaves ?? null,
        balanceCasualLeaves: (employee as any).balanceCasualLeaves ?? null,
        email: employee.user?.email,
        role: employee.user?.role ?? "",
        status: (employee.user as any)?.status ?? true,
        employeeDocuments: employee.employeeDocuments?.map((doc) => ({
          id: doc.id,
          documentName: doc.documentName,
          documentUrl: doc.documentUrl,
        })),
      }}
    />
  );
}
