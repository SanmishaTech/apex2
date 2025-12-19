"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// UI Components
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";

// Utils and API
import { swrFetcher } from "@/lib/api-client";

// Hooks
import { useProtectPage } from "@/hooks/use-protect-page";

// Types
import type {
  AttendanceWithRelations,
  EditAttendanceRequest,
} from "@/types/attendances";

interface Site {
  id: number;
  site: string;
  shortName?: string | null;
}

interface AttendanceEdit {
  id: number | null; // null for new entries
  date: string;
  manpowerId: number;
  manpowerName: string;
  category?: string | null;
  skillSet?: string | null;
  isPresent: boolean;
  isIdle: boolean;
  ot: number | null;
  isNew?: boolean; // Flag to identify new entries
}

interface AssignedManpower {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  category?: string | null;
  skillSet?: string | null;
}

export default function EditAttendancePage() {
  useProtectPage();

  const router = useRouter();
  const [siteId, setSiteId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attendances, setAttendances] = useState<AttendanceEdit[]>([]);
  const [edits, setEdits] = useState<Record<number, Partial<AttendanceEdit>>>(
    {}
  );
  const [isSaving, setIsSaving] = useState(false);

  // Fetch sites
  const { data: sitesData } = useSWR<{ data: Site[] }>(
    "/api/sites?perPage=1000",
    swrFetcher
  );

  // Fetch assigned manpower for the site
  const { data: manpowerData } = useSWR<{ data: AssignedManpower[] }>(
    siteId
      ? `/api/manpower?currentSiteId=${siteId}&isAssigned=true&perPage=1000`
      : null,
    swrFetcher
  );

  // Fetch attendances when filters change
  const shouldFetch = siteId && fromDate && toDate;
  const { data: attendanceData, mutate: refetchAttendances } = useSWR<{
    data: AttendanceWithRelations[];
  }>(
    shouldFetch
      ? `/api/attendances?siteId=${siteId}&fromDate=${fromDate}&toDate=${toDate}&perPage=1000`
      : null,
    swrFetcher
  );

  // Generate all dates between fromDate and toDate
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }

    return dates;
  };

  // Transform attendance data into editable format with all assigned manpower for all dates
  useEffect(() => {
    if (!shouldFetch || !manpowerData?.data || !fromDate || !toDate) {
      return;
    }

    const assignedManpower = manpowerData.data;
    const dateRange = generateDateRange(fromDate, toDate);
    const existingAttendance = attendanceData?.data || [];

    // Create a map of existing attendance records for quick lookup
    const attendanceMap = new Map<string, AttendanceWithRelations>();
    existingAttendance.forEach((att) => {
      const dateKey = new Date(att.date).toISOString().split("T")[0];
      const key = `${dateKey}-${att.manpowerId}`;
      attendanceMap.set(key, att);
    });

    // Generate complete attendance matrix
    const allAttendances: AttendanceEdit[] = [];
    let counter = 1;

    dateRange.forEach((date) => {
      assignedManpower.forEach((manpower) => {
        const key = `${date}-${manpower.id}`;
        const existingAtt = attendanceMap.get(key);

        const fullName = [
          manpower.firstName,
          manpower.middleName,
          manpower.lastName,
        ]
          .filter(Boolean)
          .join(" ");

        if (existingAtt) {
          // Existing attendance record
          allAttendances.push({
            id: existingAtt.id,
            date: date,
            manpowerId: manpower.id,
            manpowerName: fullName,
            category: manpower.category,
            skillSet: manpower.skillSet,
            isPresent: existingAtt.isPresent,
            isIdle: existingAtt.isIdle,
            ot: existingAtt.ot ? parseFloat(existingAtt.ot) : null,
            isNew: false,
          });
        } else {
          // New entry (no existing attendance record)
          allAttendances.push({
            id: null,
            date: date,
            manpowerId: manpower.id,
            manpowerName: fullName,
            category: manpower.category,
            skillSet: manpower.skillSet,
            isPresent: false,
            isIdle: false,
            ot: null,
            isNew: true,
          });
        }
      });
    });

    setAttendances(allAttendances);
    setEdits({});
  }, [attendanceData, manpowerData, fromDate, toDate, shouldFetch]);

  const handleFieldChange = (
    uniqueKey: string, // Use date-manpowerId as unique key
    field: keyof AttendanceEdit,
    value: any
  ) => {
    setEdits((prev) => ({
      ...prev,
      [uniqueKey]: {
        ...prev[uniqueKey],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (
    uniqueKey: string,
    field: keyof AttendanceEdit,
    attendance: AttendanceEdit
  ) => {
    return edits[uniqueKey]?.[field] !== undefined
      ? edits[uniqueKey][field]
      : attendance[field];
  };

  const handleSave = async () => {
    if (!siteId) {
      toast.error("Please select a site");
      return;
    }

    // Separate edits into updates (existing records) and new entries
    const updatesToExisting: any[] = [];
    const newEntriesToCreate: Map<string, any[]> = new Map(); // Group by date

    // Build payloads from the full attendance matrix so that new entries can be created
    // even if the user hasn't manually edited (e.g., saving all as absent).
    attendances.forEach((attendance) => {
      const uniqueKey = `${attendance.date}-${attendance.manpowerId}`;
      const changes = edits[uniqueKey] || {};

      const finalData = {
        manpowerId: attendance.manpowerId,
        isPresent:
          changes.isPresent !== undefined
            ? changes.isPresent
            : attendance.isPresent,
        isIdle:
          changes.isIdle !== undefined ? changes.isIdle : attendance.isIdle,
        ot: changes.ot !== undefined ? changes.ot : attendance.ot,
      };

      if (attendance.isNew || attendance.id === null) {
        // New entry - group by date for bulk POST
        const dateKey = attendance.date;
        if (!newEntriesToCreate.has(dateKey)) {
          newEntriesToCreate.set(dateKey, []);
        }
        newEntriesToCreate.get(dateKey)!.push(finalData);
      } else {
        // Existing record - include only if there are any changes to persist
        if (Object.keys(changes).length > 0) {
          updatesToExisting.push({
            id: attendance.id,
            ...finalData,
          });
        }
      }
    });

    if (updatesToExisting.length === 0 && newEntriesToCreate.size === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      let updateCount = 0;
      let createCount = 0;

      // Update existing attendance records
      if (updatesToExisting.length > 0) {
        const updatePayload: EditAttendanceRequest = {
          attendances: updatesToExisting,
        };

        const updateRes = await fetch("/api/attendances", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });

        if (!updateRes.ok)
          throw new Error("Failed to update existing attendance");
        updateCount = updatesToExisting.length;
      }

      // Create new attendance records (grouped by date)
      for (const [date, attendances] of newEntriesToCreate.entries()) {
        const createPayload = {
          date,
          siteId,
          attendances,
        };

        const createRes = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        if (!createRes.ok)
          throw new Error(`Failed to create attendance for ${date}`);
        createCount += attendances.length;
      }

      const message: string[] = [];
      if (updateCount > 0) message.push(`Updated ${updateCount} record(s)`);
      if (createCount > 0) message.push(`Created ${createCount} record(s)`);

      toast.success(message.join(", "));
      setEdits({});
      refetchAttendances();
    } catch (error) {
      console.error("Save error:", error);
      toast.error((error as Error).message || "Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = Object.keys(edits).length > 0;

  // Group attendances by date
  const attendancesByDate = attendances.reduce((acc, att) => {
    const dateKey = new Date(att.date).toISOString().split("T")[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(att);
    return acc;
  }, {} as Record<string, AttendanceEdit[]>);

  const sortedDates = Object.keys(attendancesByDate).sort();

  return (
    <div className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <div>
            <AppCard.Title>Edit Attendance</AppCard.Title>
            <AppCard.Description>
              Select site and date range to edit attendance records
            </AppCard.Description>
          </div>
        </AppCard.Header>

        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Site Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Site <span className="text-red-500">*</span>
              </label>
              <select
                value={siteId || ""}
                onChange={(e) =>
                  setSiteId(e.target.value ? parseInt(e.target.value) : null)
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select Site</option>
                {sitesData?.data.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site} {site.shortName ? `(${site.shortName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fromDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </AppCard.Content>
      </AppCard>

      {/* Attendance Records */}
      {shouldFetch && attendances.length > 0 && (
        <AppCard>
          <AppCard.Header>
            <div className="flex items-center justify-between">
              <div>
                <AppCard.Title>Attendance Records</AppCard.Title>
                <AppCard.Description>
                  Showing {attendances.length} record(s) from {fromDate} to{" "}
                  {toDate}
                  {manpowerData?.data && (
                    <span className="ml-2 text-sm">
                      ({manpowerData.data.length} assigned manpower ×{" "}
                      {sortedDates.length} days)
                    </span>
                  )}
                </AppCard.Description>
              </div>
              <div className="flex gap-2">
                <AppButton variant="outline" onClick={() => router.back()}>
                  Cancel
                </AppButton>
                <AppButton onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </AppButton>
              </div>
            </div>
          </AppCard.Header>

          <AppCard.Content>
            <div className="space-y-6">
              {sortedDates.map((dateKey) => {
                const records = attendancesByDate[dateKey];
                const dateObj = new Date(dateKey);
                const formattedDate = dateObj.toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });

                return (
                  <div
                    key={dateKey}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <div className="bg-muted px-4 py-3 border-b border-border">
                      <h3 className="font-semibold text-foreground">
                        {formattedDate}
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                              Sr.
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                              Manpower Name
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                              Category
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                              Skill Set
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">
                              Present
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">
                              Idle
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">
                              OT Hours
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {records.map((record, idx) => {
                            const uniqueKey = `${record.date}-${record.manpowerId}`;
                            const isNewEntry =
                              record.isNew || record.id === null;

                            return (
                              <tr
                                key={uniqueKey}
                                className={`hover:bg-muted/30 transition-colors ${
                                  isNewEntry
                                    ? "bg-blue-50/50 dark:bg-blue-950/20"
                                    : ""
                                }`}
                              >
                                <td className="px-4 py-3 text-sm text-foreground">
                                  {idx + 1}
                                  {isNewEntry && (
                                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                      (New)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-foreground font-medium">
                                  {record.manpowerName}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {record.category || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {record.skillSet || "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      getEditedValue(
                                        uniqueKey,
                                        "isPresent",
                                        record
                                      ) as boolean
                                    }
                                    onChange={(e) =>
                                      handleFieldChange(
                                        uniqueKey,
                                        "isPresent",
                                        e.target.checked
                                      )
                                    }
                                    className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      getEditedValue(
                                        uniqueKey,
                                        "isIdle",
                                        record
                                      ) as boolean
                                    }
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      handleFieldChange(
                                        uniqueKey,
                                        "isIdle",
                                        checked
                                      );
                                      if (checked) {
                                        // If a person is marked idle, they must also be present.
                                        handleFieldChange(
                                          uniqueKey,
                                          "isPresent",
                                          true
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={
                                      (getEditedValue(
                                        uniqueKey,
                                        "ot",
                                        record
                                      ) as number) || ""
                                    }
                                    onChange={(e) =>
                                      handleFieldChange(
                                        uniqueKey,
                                        "ot",
                                        e.target.value
                                          ? parseFloat(e.target.value)
                                          : null
                                      )
                                    }
                                    className="w-20 px-2 py-1 border border-input rounded bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </AppCard.Content>
        </AppCard>
      )}

      {shouldFetch && attendances.length === 0 && !attendanceData && (
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Loading attendance records...
              </p>
            </div>
          </AppCard.Content>
        </AppCard>
      )}

      {shouldFetch && attendances.length === 0 && manpowerData && (
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {manpowerData.data?.length === 0
                  ? "No manpower assigned to this site."
                  : "No attendance records found for the selected filters."}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {manpowerData.data?.length === 0
                  ? "Please assign manpower to this site first."
                  : "Try selecting a different date range or site."}
              </p>
            </div>
          </AppCard.Content>
        </AppCard>
      )}
    </div>
  );
}
