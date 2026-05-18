"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

// UI Components
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppCombobox } from "@/components/common/app-combobox";
import { z } from "zod";

// Utils and API
import { swrFetcher } from "@/lib/api-client";

// Hooks
import { useProtectPage } from "@/hooks/use-protect-page";

// Types
import type {
  AttendanceWithRelations,
} from "@/types/attendances";

interface AttendanceEdit {
  id: number | null;
  date: string;
  manpowerId: number;
  siteId: number;
  siteName: string;
  isPresent: boolean;
  isIdle: boolean;
  ot: number | null;
  isNew?: boolean;
}

export default function EditManpowerAttendancePage() {
  useProtectPage();
  const router = useRouter();

  const [manpowerId, setManpowerId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<AttendanceEdit>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Frontend validation schema
  const dateValidation = z.string().refine(
    (val) => !val || new Date(val) <= new Date(),
    { message: "Date cannot be in the future" }
  );

  // Fetch manpower for the combobox
  const { data: manpowerData } = useSWR<{ data: any[] }>(
    "/api/manpower?perPage=1000&activeOnly=true",
    swrFetcher
  );

  const manpowerOptions = useMemo(() => {
    return (manpowerData?.data || []).map((m) => ({
      value: String(m.id),
      label: `${m.firstName} ${m.middleName || ""} ${m.lastName || ""} (${m.aadharNo || "No Aadhar"})`,
    }));
  }, [manpowerData]);

  const selectedManpower = useMemo(() => {
    return (manpowerData?.data || []).find((m) => String(m.id) === manpowerId);
  }, [manpowerData, manpowerId]);

  // Fetch attendances for selected manpower and date range
  const shouldFetch = manpowerId && fromDate && toDate;
  const { data: attendanceData, mutate: refetchAttendances } = useSWR<{
    data: AttendanceWithRelations[];
  }>(
    shouldFetch
      ? `/api/attendances?manpowerId=${manpowerId}&fromDate=${fromDate}&toDate=${toDate}&perPage=1000`
      : null,
    swrFetcher
  );

  // Generate date range
  const dateRange = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const dates: string[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Safety check for 10 days limit
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 10) return [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }
    return dates;
  }, [fromDate, toDate]);

  // Grouped attendances for editing
  const siteGroups = useMemo(() => {
    if (!shouldFetch || !attendanceData || dateRange.length === 0) return [];

    const existingRecords = attendanceData.data || [];
    const groups: Record<number, { siteId: number; siteName: string; records: AttendanceEdit[] }> = {};

    // First, map existing records to their sites
    existingRecords.forEach((att) => {
      const sId = att.siteId;
      const sName = att.site?.site || "Unknown Site";
      if (!groups[sId]) {
        groups[sId] = { siteId: sId, siteName: sName, records: [] };
      }
      
      const dateStr = new Date(att.date).toISOString().split("T")[0];
      groups[sId].records.push({
        id: att.id,
        date: dateStr,
        manpowerId: att.manpowerId,
        siteId: att.siteId,
        siteName: sName,
        isPresent: att.isPresent,
        isIdle: att.isIdle,
        ot: att.ot ? parseFloat(att.ot) : null,
        isNew: false,
      });
    });

    // Handle missing dates - put them in the current site group if possible
    const currentSiteId = selectedManpower?.currentSiteId;
    const currentSiteName = selectedManpower?.currentSiteName || "Current Site";

    dateRange.forEach((date) => {
      const exists = existingRecords.some(r => new Date(r.date).toISOString().split("T")[0] === date);
      if (!exists && currentSiteId) {
        if (!groups[currentSiteId]) {
          groups[currentSiteId] = { siteId: currentSiteId, siteName: currentSiteName, records: [] };
        }
        groups[currentSiteId].records.push({
          id: null,
          date,
          manpowerId: parseInt(manpowerId),
          siteId: currentSiteId,
          siteName: currentSiteName,
          isPresent: false,
          isIdle: false,
          ot: null,
          isNew: true,
        });
      }
    });

    // Sort records within each site by date and return as array
    return Object.values(groups)
      .map(group => ({
        ...group,
        records: group.records.sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [attendanceData, dateRange, manpowerId, selectedManpower, shouldFetch]);

  const handleFieldChange = (
    uniqueKey: string,
    field: keyof AttendanceEdit,
    value: any
  ) => {
    setEdits((prev) => {
      const next = {
        ...prev,
        [uniqueKey]: {
          ...prev[uniqueKey],
          [field]: value,
        },
      } as Record<string, Partial<AttendanceEdit>>;

      // Rules from original edit-attendance
      if (field === "isIdle" && value === true) {
        next[uniqueKey] = { ...next[uniqueKey], isIdle: true, isPresent: true };
      }

      if (field === "ot") {
        const otNum = value === null || value === "" ? null : Number(value);
        if (otNum !== null && otNum !== 0) {
          next[uniqueKey] = { ...next[uniqueKey], ot: otNum, isPresent: true };
        }
      }

      return next;
    });
  };

  const getEditedValue = (
    uniqueKey: string,
    field: keyof AttendanceEdit,
    record: AttendanceEdit
  ) => {
    return edits[uniqueKey]?.[field] !== undefined
      ? edits[uniqueKey][field]
      : record[field];
  };

  const handleSave = async () => {
    if (!shouldFetch) return;

    const updates: any[] = [];
    const createsByDate: Record<string, { siteId: number; attendances: any[] }> = {};

    siteGroups.forEach(group => {
      group.records.forEach(record => {
        const uniqueKey = `${record.siteId}-${record.date}`;
        const changes = edits[uniqueKey] || {};
        
        const finalData = {
          manpowerId: record.manpowerId,
          isPresent: changes.isPresent !== undefined ? changes.isPresent : record.isPresent,
          isIdle: changes.isIdle !== undefined ? changes.isIdle : record.isIdle,
          ot: changes.ot !== undefined ? changes.ot : record.ot,
        };

        if (record.id) {
          if (Object.keys(changes).length > 0) {
            updates.push({ id: record.id, ...finalData });
          }
        } else {
          // New record - only save if edited OR if you want to save the default state
          // For consistency with edit-attendance, we should save if there's a current site
          const dateKey = record.date;
          if (!createsByDate[dateKey]) {
            createsByDate[dateKey] = { siteId: record.siteId, attendances: [] };
          }
          createsByDate[dateKey].attendances.push(finalData);
        }
      });
    });

    if (updates.length === 0 && Object.keys(createsByDate).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      if (updates.length > 0) {
        const res = await fetch("/api/attendances", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendances: updates }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update records");
        }
      }

      for (const [date, data] of Object.entries(createsByDate)) {
        const res = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            siteId: data.siteId,
            attendances: data.attendances,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create records for ${date}`);
        }
      }

      toast.success("Attendance saved successfully");
      setEdits({});
      refetchAttendances();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Edit Manpower Attendance</AppCard.Title>
          <AppCard.Description>
            Select a manpower and date range (max 10 days) to edit records. Attendance will be grouped by site.
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Manpower</label>
              <AppCombobox
                value={manpowerId}
                onValueChange={setManpowerId}
                options={manpowerOptions}
                placeholder="Select Manpower"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">From Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={fromDate}
                max={today}
                onChange={(e) => {
                  const val = e.target.value;
                  try {
                    dateValidation.parse(val);
                    setFromDate(val);
                  } catch (err: any) {
                    toast.error(err.errors?.[0]?.message || "Invalid date");
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">To Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={(e) => {
                  const val = e.target.value;
                  try {
                    dateValidation.parse(val);
                    if (fromDate && val) {
                      const start = new Date(fromDate);
                      const end = new Date(val);
                      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      if (diff > 10) {
                        toast.error("Maximum 10 days range allowed");
                        return;
                      }
                    }
                    setToDate(val);
                  } catch (err: any) {
                    toast.error(err.errors?.[0]?.message || "Invalid date");
                  }
                }}
              />
            </div>
          </div>
        </AppCard.Content>
      </AppCard>

      {shouldFetch && siteGroups.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <AppButton variant="outline" onClick={() => router.back()} className="text-black dark:text-white">Cancel</AppButton>
            <AppButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </AppButton>
          </div>

          {siteGroups.map((group) => (
            <AppCard key={group.siteId}>
              <AppCard.Header className="bg-muted/50">
                <AppCard.Title className="text-lg">{group.siteName}</AppCard.Title>
              </AppCard.Header>
              <AppCard.Content className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">Present</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">Idle</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.records.map((record) => {
                        const uniqueKey = `${record.siteId}-${record.date}`;
                        return (
                          <tr key={uniqueKey} className={record.id ? "" : "bg-blue-50/30 dark:bg-blue-950/10"}>
                            <td className="px-4 py-3 text-sm">
                              {new Date(record.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                              {!record.id && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">(New)</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={getEditedValue(uniqueKey, "isPresent", record) as boolean}
                                onChange={(e) => {
                                  const isIdleNow = getEditedValue(uniqueKey, "isIdle", record) as boolean;
                                  const otNow = Number(getEditedValue(uniqueKey, "ot", record) || 0);
                                  if (otNow !== 0 && !e.target.checked) return;
                                  if (isIdleNow && !e.target.checked) return;
                                  handleFieldChange(uniqueKey, "isPresent", e.target.checked);
                                }}
                                className="w-4 h-4 rounded border-gray-300"
                                disabled={getEditedValue(uniqueKey, "isIdle", record) === true || Number(getEditedValue(uniqueKey, "ot", record)) !== 0}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={getEditedValue(uniqueKey, "isIdle", record) as boolean}
                                onChange={(e) => handleFieldChange(uniqueKey, "isIdle", e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                className="border rounded px-2 py-1 bg-background text-sm"
                                value={getEditedValue(uniqueKey, "ot", record) as number || ""}
                                onChange={(e) => handleFieldChange(uniqueKey, "ot", e.target.value ? parseFloat(e.target.value) : null)}
                              >
                                <option value="">0</option>
                                {[-0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AppCard.Content>
            </AppCard>
          ))}
        </div>
      )}

      {shouldFetch && siteGroups.length === 0 && (
        <AppCard>
          <AppCard.Content className="text-center py-12 text-muted-foreground">
            No records found and no current site assignment for this manpower.
          </AppCard.Content>
        </AppCard>
      )}
    </div>
  );
}
