'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// UI Components
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';

// Utils and API
import { swrFetcher } from '@/lib/api-client';

// Hooks
import { useProtectPage } from '@/hooks/use-protect-page';

// Types
import type { AttendanceWithRelations, EditAttendanceRequest } from '@/types/attendances';

interface Site {
  id: number;
  site: string;
  shortName?: string | null;
}

interface AttendanceEdit {
  id: number;
  date: string;
  manpowerId: number;
  manpowerName: string;
  category?: string | null;
  skillSet?: string | null;
  isPresent: boolean;
  isIdle: boolean;
  ot: number | null;
}

export default function EditAttendancePage() {
  useProtectPage();

  const router = useRouter();
  const [siteId, setSiteId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [attendances, setAttendances] = useState<AttendanceEdit[]>([]);
  const [edits, setEdits] = useState<Record<number, Partial<AttendanceEdit>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch sites
  const { data: sitesData } = useSWR<{ data: Site[] }>(
    '/api/sites?perPage=1000',
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

  // Transform attendance data into editable format
  useEffect(() => {
    if (attendanceData?.data) {
      const transformed = attendanceData.data.map((att) => {
        const fullName = [
          att.manpower?.firstName,
          att.manpower?.middleName,
          att.manpower?.lastName,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          id: att.id,
          date: att.date,
          manpowerId: att.manpowerId,
          manpowerName: fullName,
          category: att.manpower?.category,
          skillSet: att.manpower?.skillSet,
          isPresent: att.isPresent,
          isIdle: att.isIdle,
          ot: att.ot ? parseFloat(att.ot) : null,
        };
      });
      setAttendances(transformed);
      setEdits({});
    }
  }, [attendanceData]);

  const handleFieldChange = (
    id: number,
    field: keyof AttendanceEdit,
    value: any
  ) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (id: number, field: keyof AttendanceEdit) => {
    const attendance = attendances.find((a) => a.id === id);
    if (!attendance) return undefined;
    return edits[id]?.[field] !== undefined ? edits[id][field] : attendance[field];
  };

  const handleSave = async () => {
    const changedAttendances = Object.entries(edits)
      .filter(([_, changes]) => Object.keys(changes).length > 0)
      .map(([id, changes]) => {
        const attendance = attendances.find((a) => a.id === parseInt(id));
        if (!attendance) return null;

        return {
          id: parseInt(id),
          isPresent: changes.isPresent !== undefined ? changes.isPresent : attendance.isPresent,
          isIdle: changes.isIdle !== undefined ? changes.isIdle : attendance.isIdle,
          ot: changes.ot !== undefined ? changes.ot : attendance.ot,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (changedAttendances.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      const payload: EditAttendanceRequest = {
        attendances: changedAttendances,
      };

      await fetch('/api/attendances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      toast.success(`Updated ${changedAttendances.length} attendance record(s)`);
      setEdits({});
      refetchAttendances();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = Object.keys(edits).length > 0;

  // Group attendances by date
  const attendancesByDate = attendances.reduce((acc, att) => {
    const dateKey = new Date(att.date).toISOString().split('T')[0];
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
                value={siteId || ''}
                onChange={(e) => setSiteId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select Site</option>
                {sitesData?.data.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site} {site.shortName ? `(${site.shortName})` : ''}
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
                  Showing {attendances.length} record(s) from {fromDate} to {toDate}
                </AppCard.Description>
              </div>
              <div className="flex gap-2">
                <AppButton
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </AppButton>
                <AppButton
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? 'Saving...' : `Save Changes${hasChanges ? ` (${Object.keys(edits).length})` : ''}`}
                </AppButton>
              </div>
            </div>
          </AppCard.Header>

          <AppCard.Content>
            <div className="space-y-6">
              {sortedDates.map((dateKey) => {
                const records = attendancesByDate[dateKey];
                const dateObj = new Date(dateKey);
                const formattedDate = dateObj.toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });

                return (
                  <div key={dateKey} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-3 border-b border-border">
                      <h3 className="font-semibold text-foreground">{formattedDate}</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Sr.</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Manpower Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Category</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Skill Set</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Present</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Idle</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground">OT Hours</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {records.map((record, idx) => (
                            <tr
                              key={record.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 text-sm text-foreground font-medium">
                                {record.manpowerName}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {record.category || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {record.skillSet || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={getEditedValue(record.id, 'isPresent') as boolean}
                                  onChange={(e) =>
                                    handleFieldChange(record.id, 'isPresent', e.target.checked)
                                  }
                                  className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={getEditedValue(record.id, 'isIdle') as boolean}
                                  onChange={(e) =>
                                    handleFieldChange(record.id, 'isIdle', e.target.checked)
                                  }
                                  className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={getEditedValue(record.id, 'ot') as number || ''}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      record.id,
                                      'ot',
                                      e.target.value ? parseFloat(e.target.value) : null
                                    )
                                  }
                                  className="w-20 px-2 py-1 border border-input rounded bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          ))}
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
              <p className="text-muted-foreground">Loading attendance records...</p>
            </div>
          </AppCard.Content>
        </AppCard>
      )}

      {shouldFetch && attendances.length === 0 && attendanceData && (
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No attendance records found for the selected filters.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try selecting a different date range or site.
              </p>
            </div>
          </AppCard.Content>
        </AppCard>
      )}
    </div>
  );
}
