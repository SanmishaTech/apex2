'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ClipboardCheck, Save, AlertCircle, Calendar, User, Clock, CheckCircle2 } from 'lucide-react';

import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { PERMISSIONS } from '@/config/roles';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import type { ManpowerAttendanceItem } from '@/types/attendances';
import { formatDateForInput } from '@/lib/locales';

interface SiteManpowerResponse {
  site: {
    id: number;
    site: string;
  };
  manpower: ManpowerAttendanceItem[];
}

export default function MarkAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { pushAndRestoreKey } = useScrollRestoration('attendance-mark');
  const { id } = use(params);
  const siteId = parseInt(id);

  const goBack = () => {
    pushAndRestoreKey('attendances-list');
  };

  const [attendanceDate, setAttendanceDate] = useState<string>('');
  const [manpowerData, setManpowerData] = useState<ManpowerAttendanceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastAttendanceDate, setLastAttendanceDate] = useState<string | null>(null);
  const [canMarkAttendance, setCanMarkAttendance] = useState(false);

  const { data, error, isLoading } = useSWR<SiteManpowerResponse>(
    `/api/attendances/site/${siteId}`,
    apiGet
  );

  // Fetch last attendance record for this site to calculate next date
  const { data: lastAttendanceData } = useSWR<any>(
    `/api/attendances?siteId=${siteId}&perPage=1`,
    apiGet
  );

  // Calculate next attendance date based on last recorded date
  useEffect(() => {
    if (lastAttendanceData?.data && lastAttendanceData.data.length > 0) {
      // Get the most recent attendance date
      const lastRecord = lastAttendanceData.data[0];
      const lastDate = new Date(lastRecord.date);
      setLastAttendanceDate(lastDate.toISOString().split('T')[0]);
      
      // Calculate next date (last date + 1 day)
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = formatDateForInput(nextDate);
      
      // Get today's date
      const today = formatDateForInput(new Date());
      
      console.log('Attendance dates:', {
        lastDate: lastDate.toISOString().split('T')[0],
        nextDate: nextDateStr,
        today: today
      });
      
      // Only allow marking if next date hasn't been recorded yet
      // i.e., if next calculated date <= today
      if (nextDateStr <= today) {
        setAttendanceDate(nextDateStr);
        setCanMarkAttendance(true);
      } else {
        // Next date is in the future
        setAttendanceDate(nextDateStr);
        setCanMarkAttendance(false);
      }
    } else {
      // No previous attendance, start from today
      const today = formatDateForInput(new Date());
      setAttendanceDate(today);
      setLastAttendanceDate(null);
      setCanMarkAttendance(true);
    }
  }, [lastAttendanceData]);

  useEffect(() => {
    if (data?.manpower) {
      setManpowerData(data.manpower);
    }
  }, [data]);

  const handleFieldChange = (
    manpowerId: number,
    field: 'isPresent' | 'isIdle' | 'ot',
    value: boolean | number
  ) => {
    setManpowerData((prev) =>
      prev.map((m) => (m.id === manpowerId ? { ...m, [field]: value } : m))
    );
  };

  const handleSave = async () => {
    if (!attendanceDate) {
      toast.error('Please select attendance date');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: attendanceDate,
        siteId,
        attendances: manpowerData.map((m) => ({
          manpowerId: m.id,
          isPresent: m.isPresent,
          isIdle: m.isIdle,
          ot: m.ot || 0,
        })),
      };

      await apiPost('/api/attendances', payload);
      toast.success('Attendance marked successfully');
      router.push('/attendances');
    } catch (error: any) {
      console.error('Save attendance error:', error);
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className="p-6 text-red-600">Failed to load site data</div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          <ClipboardCheck className="w-5 h-5 mr-2" />
          Mark Attendance - {data?.site.site || 'Loading...'}
        </AppCard.Title>
        <AppCard.Description>Mark attendance for assigned manpower at this site.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        {isLoading ? (
          <div className="p-6">Loading...</div>
        ) : !canMarkAttendance ? (
          <div className="p-6">
            <div className="max-w-2xl mx-auto">
              <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-xl shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                      Attendance Already Up to Date
                    </h4>
                    <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span>Last recorded: <strong className="font-semibold">{lastAttendanceDate ? new Date(lastAttendanceDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong></span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Next date: <strong className="font-semibold">{new Date(attendanceDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
                      </p>
                    </div>
                    <div className="mt-4 p-3 bg-white/60 dark:bg-black/20 rounded-lg border border-amber-200 dark:border-amber-700">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Note:</strong> The next attendance date is in the future. You can only mark attendance for dates up to today.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <AppButton variant="outline" onClick={goBack}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Back to Sites
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Attendance Date Display (read-only) */}
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-blue-900 dark:text-blue-100 mb-2">
                    Marking Attendance For
                  </h4>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {new Date(attendanceDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    {lastAttendanceDate && (
                      <span className="text-sm text-blue-600 dark:text-blue-400 px-3 py-1 bg-white/60 dark:bg-black/20 rounded-full">
                        Last: {new Date(lastAttendanceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Manpower Table */}
            {manpowerData.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="p-4 bg-muted rounded-full">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No assigned manpower found for this site</p>
                  <AppButton variant="outline" size="sm" onClick={goBack}>
                    Back to Sites
                  </AppButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Manpower List ({manpowerData.length})
                  </h3>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
                      Present
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700" />
                      Idle
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Sr No</th>
                      <th className="px-4 py-3 text-left font-medium">Manpower Name</th>
                      <th className="px-4 py-3 text-left font-medium">Last Attendance</th>
                      <th className="px-4 py-3 text-center font-medium">OT</th>
                      <th className="px-4 py-3 text-center font-medium">Attendance</th>
                      <th className="px-4 py-3 text-center font-medium">Idle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manpowerData.map((manpower, index) => {
                      const fullName = [
                        manpower.firstName,
                        manpower.middleName,
                        manpower.lastName,
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <tr key={manpower.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3">{fullName}</td>
                          <td className="px-4 py-3">
                            {manpower.lastAttendance
                              ? new Date(manpower.lastAttendance).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={manpower.ot}
                              onChange={(e) =>
                                handleFieldChange(
                                  manpower.id,
                                  'ot',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 px-2 py-1 border border-input bg-background text-foreground rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={manpower.isPresent}
                              onChange={(e) =>
                                handleFieldChange(manpower.id, 'isPresent', e.target.checked)
                              }
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={manpower.isIdle}
                              onChange={(e) =>
                                handleFieldChange(manpower.id, 'isIdle', e.target.checked)
                              }
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </AppCard.Content>
      {canMarkAttendance && (
        <AppCard.Footer>
          <div className="flex items-center justify-between">
            <AppButton variant="outline" onClick={goBack}>
              <Calendar className="w-4 h-4 mr-2" />
              Back to Sites
            </AppButton>
            <AppButton 
              onClick={handleSave} 
              isLoading={saving} 
              disabled={manpowerData.length === 0}
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Attendance for {manpowerData.length} Workers
            </AppButton>
          </div>
        </AppCard.Footer>
      )}
    </AppCard>
  );
}
