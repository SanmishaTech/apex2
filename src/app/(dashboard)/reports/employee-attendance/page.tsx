"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx-js-style";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppCombobox } from "@/components/common/app-combobox";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type SiteOption = {
  id: number;
  site: string;
  siteCode?: string | null;
  shortName?: string | null;
};

type ReportRow = {
  date: string;
  site: { id: number; name: string; code: string | null };
  employee: { id: number; name: string };
  workHours: number;
  workDuration?: string;
  workDay: 0 | 1;
  in: {
    time: string;
    imageUrl: string | null;
    latitude: string | null;
    longitude: string | null;
    accuracy: string | null;
    createdByName: string | null;
  } | null;
  out: {
    time: string;
    imageUrl: string | null;
    latitude: string | null;
    longitude: string | null;
    accuracy: string | null;
    createdByName: string | null;
  } | null;
};

type ReportResponse = {
  data: ReportRow[];
  meta: { siteId: number; fromDate: string; toDate: string; total: number };
};

function AddressCell({
  latitude,
  longitude,
  accuracy,
}: {
  latitude: string | null;
  longitude: string | null;
  accuracy: string | null;
}) {
  if (!latitude || !longitude) return <span className="text-muted-foreground">—</span>;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${latitude},${longitude}`
  )}`;

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">
        Lat: <span className="text-foreground">{latitude}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Lng: <span className="text-foreground">{longitude}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Acc: <span className="text-foreground">{accuracy ?? "—"}</span>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-blue-700 dark:text-blue-300 underline"
      >
        View on Map
      </a>
    </div>
  );
}

function ImageCell({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return <span className="text-muted-foreground">—</span>;

  const absoluteUrl = (() => {
    try {
      return new URL(imageUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();
    } catch {
      return imageUrl;
    }
  })();

  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex w-24 flex-col gap-1">
      <div className="relative h-16 w-24 overflow-hidden rounded-md border border-border bg-muted">
        <img
          src={absoluteUrl}
          alt="Attendance"
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
      <a
        href={absoluteUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-blue-700 dark:text-blue-300 underline"
      >
        View
      </a>
    </div>
  );
}

export default function EmployeeAttendanceReportPage() {
  const { can } = usePermissions();
  const canView = can(PERMISSIONS.VIEW_EMPLOYEE_ATTENDANCE);
  if (!canView) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Attendance reports.
      </div>
    );
  }

  const { data: sitesData, isLoading: sitesLoading } = useSWR<{ data: SiteOption[] }>(
    "/api/sites?perPage=1000&sort=site&order=asc",
    apiGet
  );

  const siteOptions = useMemo(() => {
    const sites = sitesData?.data || [];
    return sites.map((s) => ({
      value: String(s.id),
      label: s.shortName ? `${s.shortName} - ${s.site}` : s.site,
    }));
  }, [sitesData]);

  const siteById = useMemo(() => {
    const m = new Map<string, SiteOption>();
    (sitesData?.data || []).forEach((s) => m.set(String(s.id), s));
    return m;
  }, [sitesData]);

  const [siteId, setSiteId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [queryUrl, setQueryUrl] = useState<string | null>(null);

  const { data: reportData, error, isLoading } = useSWR<ReportResponse>(queryUrl, apiGet);

  useEffect(() => {
    if (error) {
      toast.error((error as any)?.message || "Failed to load attendance report");
    }
  }, [error]);

  const selectedSite = siteId ? siteById.get(siteId) : undefined;

  const exportExcel = () => {
    if (!canView) {
      toast.error("You do not have permission to export this report");
      return;
    }
    if (!reportData?.data?.length) {
      toast.error("No data to export");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const toAbs = (url: string | null | undefined) => {
      if (!url) return "";
      try {
        return new URL(url, origin || "http://localhost").toString();
      } catch {
        return url;
      }
    };

    const formatDdMmYyyy = (yyyyMmDd: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
      const [y, m, d] = yyyyMmDd.split("-");
      return `${d}/${m}/${y}`;
    };

    const generatedOn = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    const header = [
      "Sr.No",
      "Date",
      "Site",
      "Employee",
      "Work Duration",
      "Work Day",
      "In Time",
      "In Address",
      "Out Time",
      "Out Address",
      "IN By",
      "OUT By",
    ];

    const rows = reportData.data.map((r, idx) => {
      const inAddr = r.in?.latitude && r.in?.longitude ? `Lat:${r.in.latitude} Lng:${r.in.longitude} Acc:${r.in.accuracy ?? "—"}` : "—";
      const outAddr = r.out?.latitude && r.out?.longitude ? `Lat:${r.out.latitude} Lng:${r.out.longitude} Acc:${r.out.accuracy ?? "—"}` : "—";
      return {
        srNo: idx + 1,
        date: r.date,
        site: r.site.name,
        employee: r.employee.name,
        workDuration: r.workDuration ?? `${r.workHours.toFixed(2)} hrs`,
        workDay: r.workDay,
        inTime: r.in?.time ?? "—",
        inAddress: inAddr,
        outTime: r.out?.time ?? "—",
        outAddress: outAddr,
        inBy: r.in?.createdByName ?? "—",
        outBy: r.out?.createdByName ?? "—",
      };
    });

    const metaRows = [
      ["Site", selectedSite?.site ?? ""],
      ["From Date", fromDate ? formatDdMmYyyy(fromDate) : ""],
      ["To Date", toDate ? formatDdMmYyyy(toDate) : ""],
      ["Generated On", generatedOn],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...metaRows, header]);
    XLSX.utils.sheet_add_aoa(
      ws,
      rows.map((r) => [
        r.srNo,
        r.date,
        r.site,
        r.employee,
        r.workDuration,
        r.workDay,
        r.inTime,
        r.inAddress,
        r.outTime,
        r.outAddress,
        r.inBy,
        r.outBy,
      ]),
      { origin: { r: metaRows.length + 1, c: 0 } }
    );

    const dataStartRow = metaRows.length + 2;
    const lastRow = rows.length + (dataStartRow - 1);

    ws["!rows"] = Array.from({ length: lastRow }, (_, idx) => {
      const oneBased = idx + 1;
      if (oneBased <= metaRows.length) return { hpt: 16 };
      if (oneBased === metaRows.length + 1) return { hpt: 18 };
      if (oneBased === metaRows.length + 2) return { hpt: 18 };
      return { hpt: 18 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const siteName = selectedSite?.site ? selectedSite.site.replace(/\s+/g, "-") : "site";
    const fname = `employee-attendance-${siteName}-${fromDate || "from"}-${toDate || "to"}.xlsx`;
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleSearch = () => {
    if (!canView) {
      toast.error("You do not have permission to view this report");
      return;
    }
    if (!siteId) {
      toast.error("Please select a site");
      return;
    }
    if (!fromDate || !toDate) {
      toast.error("Please select From Date and To Date");
      return;
    }
    if (fromDate > toDate) {
      toast.error("From Date must be less than or equal to To Date");
      return;
    }

    const params = new URLSearchParams();
    params.set("siteId", siteId);
    params.set("fromDate", fromDate);
    params.set("toDate", toDate);
    setQueryUrl(`/api/reports/employee-attendance?${params.toString()}`);
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Employee Attendance Report</AppCard.Title>
        <AppCard.Description>
          Select site and date range, then click Search.
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Site</label>
              <div className="mt-1">
                <AppCombobox
                  value={siteId || undefined}
                  onValueChange={(v) => setSiteId(v)}
                  options={siteOptions}
                  placeholder={sitesLoading ? "Loading..." : "Select site"}
                  searchPlaceholder="Search site..."
                  emptyText="No site found."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring text-sm"
                required
              />
            </div>

            <div className="md:col-span-4 flex justify-end gap-2">
              <AppButton type="button" onClick={handleSearch} disabled={isLoading || !canView}>
                Search
              </AppButton>
              <AppButton
                type="button"
                onClick={exportExcel}
                disabled={isLoading || !canView || !reportData?.data?.length}
              >
                Export Excel
              </AppButton>
            </div>
          </div>

          {isLoading && (
            <div className="p-6 text-center text-muted-foreground">
              Loading...
            </div>
          )}

          {!isLoading && queryUrl && reportData && reportData.data.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No data found.
            </div>
          )}

          {!isLoading && reportData && reportData.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full border-collapse">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">Sr.No</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">Date</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider min-w-[160px] border border-border">Site</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider min-w-[160px] border border-border">Employee</th>
                    <th className="px-2 py-2 text-center text-[11px] font-semibold text-foreground uppercase tracking-wider bg-sky-50 dark:bg-sky-950/30 border border-border">Work Duration</th>
                    <th className="px-2 py-2 text-center text-[11px] font-semibold text-foreground uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 border border-border">Work Day</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">In Time</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">In Image</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">In Address</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">Out Time</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">Out Image</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">Out Address</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">Attendance By</th>
                  </tr>
                </thead>
                <tbody className="bg-background">
                  {reportData.data.map((r, idx) => (
                    <tr key={`${r.employee.id}-${r.date}`} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5 text-xs text-foreground border border-border">{idx + 1}</td>
                      <td className="px-2 py-1.5 text-xs text-foreground whitespace-nowrap border border-border">{r.date}</td>
                      <td className="px-2 py-1.5 text-xs text-foreground border border-border">
                        <div className="font-medium">{r.site.name}</div>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground font-medium border border-border">{r.employee.name}</td>
                      <td className="px-2 py-1.5 text-xs text-center font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/60 dark:bg-sky-950/20 border border-border whitespace-nowrap">
                        {r.workDuration ?? `${r.workHours.toFixed(2)} hrs`}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-center font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 border border-border">
                        {r.workDay}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground bg-blue-50/40 dark:bg-blue-950/10 whitespace-nowrap border border-border">
                        {r.in?.time ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 bg-blue-50/40 dark:bg-blue-950/10 border border-border">
                        <ImageCell imageUrl={r.in?.imageUrl ?? null} />
                      </td>
                      <td className="px-2 py-1.5 bg-blue-50/40 dark:bg-blue-950/10 border border-border">
                        <AddressCell
                          latitude={r.in?.latitude ?? null}
                          longitude={r.in?.longitude ?? null}
                          accuracy={r.in?.accuracy ?? null}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground bg-rose-50/40 dark:bg-rose-950/10 whitespace-nowrap border border-border">
                        {r.out?.time ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 bg-rose-50/40 dark:bg-rose-950/10 border border-border">
                        <ImageCell imageUrl={r.out?.imageUrl ?? null} />
                      </td>
                      <td className="px-2 py-1.5 bg-rose-50/40 dark:bg-rose-950/10 border border-border">
                        <AddressCell
                          latitude={r.out?.latitude ?? null}
                          longitude={r.out?.longitude ?? null}
                          accuracy={r.out?.accuracy ?? null}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground border border-border">
                        <div className="space-y-1">
                          <div>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">IN:</span>{" "}
                            <span className="text-xs">{r.in?.createdByName ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">OUT:</span>{" "}
                            <span className="text-xs">{r.out?.createdByName ?? "—"}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppCard.Content>
    </AppCard>
  );
}
