"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppCombobox } from "@/components/common/app-combobox";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";

type ReportRow = {
  date: string;
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
    address: string | null;
    createdByName: string | null;
  } | null;
  out: {
    time: string;
    imageUrl: string | null;
    latitude: string | null;
    longitude: string | null;
    accuracy: string | null;
    address: string | null;
    createdByName: string | null;
  } | null;
};

type ReportResponse = {
  data: ReportRow[];
  meta: { month: string; total: number };
};

const getMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const getLabel = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  const currentValue = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  options.push({ value: currentValue, label: getLabel(currentYear, currentMonth) });

  const prevDate = new Date(currentYear, currentMonth - 2);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevValue = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  options.push({ value: prevValue, label: getLabel(prevYear, prevMonth) });

  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    for (let month = 1; month <= 12; month++) {
      const value = `${year}-${String(month).padStart(2, "0")}`;
      if (value === currentValue || value === prevValue) continue;
      options.push({ value, label: getLabel(year, month) });
    }
  }

  const firstTwo = options.slice(0, 2);
  const rest = options.slice(2).sort((a, b) => b.value.localeCompare(a.value));
  return [...firstTwo, ...rest];
};

function AddressCell({
  address,
  latitude,
  longitude,
  accuracy,
}: {
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  accuracy: string | null;
}) {
  if (address) {
    return (
      <div className="text-xs text-foreground whitespace-pre-wrap break-words">
        {address}
      </div>
    );
  }

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

  const resolvedUrl = imageUrl.startsWith("/uploads/") ? `/api${imageUrl}` : imageUrl;

  const absoluteUrl = (() => {
    try {
      return new URL(
        resolvedUrl,
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      ).toString();
    } catch {
      return resolvedUrl;
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

export default function MyAttendancePage() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [month, setMonth] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(currentMonth);
  }, []);

  const [queryUrl, setQueryUrl] = useState<string | null>(null);
  const { data: reportData, error, isLoading } = useSWR<ReportResponse>(queryUrl, apiGet);

  useEffect(() => {
    if (error) {
      toast.error((error as any)?.message || "Failed to load attendance");
    }
  }, [error]);

  const handleSearch = () => {
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    const params = new URLSearchParams();
    params.set("month", month);
    setQueryUrl(`/api/reports/my-attendance?${params.toString()}`);
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>My Attendance</AppCard.Title>
        <AppCard.Description>
          Select month, then click Search.
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-medium">Month *</label>
              <div className="mt-1">
                <AppCombobox
                  value={month || undefined}
                  onValueChange={(v) => setMonth(v)}
                  options={monthOptions}
                  placeholder="Select month"
                  searchPlaceholder="Search month..."
                  emptyText="No month found."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <AppButton type="button" onClick={handleSearch} disabled={isLoading}>
                Search
              </AppButton>
            </div>
          </div>

          {isLoading && (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          )}

          {!isLoading && queryUrl && reportData && reportData.data.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">No data found.</div>
          )}

          {!isLoading && reportData && reportData.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full border-collapse">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">
                      Sr.No
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">
                      Date
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider min-w-[160px] border border-border">
                      Employee
                    </th>
                    <th className="px-2 py-2 text-center text-[11px] font-semibold text-foreground uppercase tracking-wider bg-sky-50 dark:bg-sky-950/30 border border-border">
                      Work Duration
                    </th>
                    <th className="px-2 py-2 text-center text-[11px] font-semibold text-foreground uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 border border-border">
                      Work Day
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">
                      In Time
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">
                      In Image
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 border border-border">
                      In Address
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">
                      Out Time
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">
                      Out Image
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 border border-border">
                      Out Address
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">
                      Attendance By
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-background">
                  {reportData.data.map((r, idx) => (
                    <tr key={`${r.employee.id}-${r.date}`} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5 text-xs text-foreground border border-border">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground whitespace-nowrap border border-border">
                        {r.date}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-foreground font-medium border border-border">
                        {r.employee.name}
                      </td>
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
                          address={r.in?.address ?? null}
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
                          address={r.out?.address ?? null}
                          latitude={r.out?.latitude ?? null}
                          longitude={r.out?.longitude ?? null}
                          accuracy={r.out?.accuracy ?? null}
                        />
                      </td>

                      <td className="px-2 py-1.5 text-xs text-foreground border border-border">
                        <div className="space-y-1">
                          <div>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                              IN:
                            </span>{" "}
                            <span className="text-xs">{r.in?.createdByName ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                              OUT:
                            </span>{" "}
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
