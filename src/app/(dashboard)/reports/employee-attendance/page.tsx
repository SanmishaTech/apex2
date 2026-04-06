"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppCombobox } from "@/components/common/app-combobox";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

// Helper to fetch image and convert to base64
async function getImageAsBase64(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const fullUrl = imageUrl.startsWith("http") 
      ? imageUrl 
      : `${window.location.origin}${imageUrl}`;
    const response = await fetch(fullUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type EmployeeOption = {
  id: number;
  name: string;
};

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
  meta: { month: string; total: number };
};

// Generate month options (current year ± 2 years) with current and previous month at top
const getMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Helper to get month label
  const getLabel = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };
  
  // Add current month first
  const currentValue = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  options.push({ value: currentValue, label: getLabel(currentYear, currentMonth) });
  
  // Add previous month second (handle year boundary)
  const prevDate = new Date(currentYear, currentMonth - 2); // month - 2 because currentMonth is 1-based
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevValue = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  options.push({ value: prevValue, label: getLabel(prevYear, prevMonth) });
  
  // Add all other months (current year ± 2 years), excluding current and previous
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    for (let month = 1; month <= 12; month++) {
      const value = `${year}-${String(month).padStart(2, "0")}`;
      // Skip if already added (current or previous)
      if (value === currentValue || value === prevValue) continue;
      options.push({ value, label: getLabel(year, month) });
    }
  }
  
  // Sort remaining options (after first two) in reverse chronological order
  const firstTwo = options.slice(0, 2);
  const rest = options.slice(2).sort((a, b) => b.value.localeCompare(a.value));
  return [...firstTwo, ...rest];
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

  const resolvedUrl = imageUrl.startsWith("/uploads/") ? `/api${imageUrl}` : imageUrl;

  const absoluteUrl = (() => {
    try {
      return new URL(resolvedUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();
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

  const { data: employeesData, isLoading: employeesLoading } = useSWR<{ data: EmployeeOption[] }>(
    "/api/employees?perPage=1000&sort=name&order=asc",
    apiGet
  );

  const employeeOptions = useMemo(() => {
    const employees = employeesData?.data || [];
    return employees.map((e) => ({
      value: String(e.id),
      label: e.name,
    }));
  }, [employeesData]);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const [employeeId, setEmployeeId] = useState<string>("");
  const [month, setMonth] = useState<string>("");

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(currentMonth);
  }, []);

  const [queryUrl, setQueryUrl] = useState<string | null>(null);

  const { data: reportData, error, isLoading } = useSWR<ReportResponse>(queryUrl, apiGet);

  useEffect(() => {
    if (error) {
      toast.error((error as any)?.message || "Failed to load attendance report");
    }
  }, [error]);

  const exportPDF = async () => {
    if (!canView) {
      toast.error("You do not have permission to export this report");
      return;
    }
    if (!reportData?.data?.length) {
      toast.error("No data to export");
      return;
    }

    toast.loading("Loading images for PDF...", { id: "pdf-export" });

    // Pre-fetch all images
    const imageCache = new Map<string, string | null>();
    const imagePromises: Promise<void>[] = [];

    // Sort data alphabetically by employee name, then by date
    const sortedData = [...reportData.data].sort((a, b) => {
      // First sort by employee name alphabetically
      const nameCompare = a.employee.name.localeCompare(b.employee.name);
      if (nameCompare !== 0) return nameCompare;
      // Then sort by date chronologically
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Pre-fetch all images using sorted data
    sortedData.forEach((r) => {
      if (r.in?.imageUrl) {
        imagePromises.push(
          getImageAsBase64(r.in.imageUrl).then((data) => {
            imageCache.set(`in-${r.date}-${r.employee.id}`, data);
          })
        );
      }
      if (r.out?.imageUrl) {
        imagePromises.push(
          getImageAsBase64(r.out.imageUrl).then((data) => {
            imageCache.set(`out-${r.date}-${r.employee.id}`, data);
          })
        );
      }
    });

    await Promise.all(imagePromises);
    toast.success("Images loaded, generating PDF...", { id: "pdf-export", duration: 2000 });

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // DCTPL Company Heading
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DCTPL", pageWidth / 2, 12, { align: "center" });
    
    // Report Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Employee Attendance Report", pageWidth / 2, 19, { align: "center" });

    // Generated timestamp (dd/mm/yyyy hh:mm:ss AM/PM IST)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
    
    doc.setFontSize(9);
    doc.text(`Generated on: ${day}/${month}/${year} ${formattedTime} IST`, pageWidth - 14, 25, { align: "right" });

    // Report details
    doc.setFontSize(10);
    let y = 32;
    doc.text(`Month: ${monthOptions.find(m => m.value === month)?.label || month}`, 14, y);
    y += 5;
    if (employeeId) {
      const emp = employeeOptions.find(e => e.value === employeeId);
      doc.text(`Employee: ${emp?.label || "—"}`, 14, y);
      y += 5;
    }
    y += 3;

    // Build table data using sorted data
    const headers = [
      "Sr.No",
      "Date",
      "Employee",
      "Work Duration",
      "Work Day",
      "In Time",
      "In Image",
      "In Address",
      "Out Time",
      "Out Image",
      "Out Address",
      "Attendance By",
    ];

    const body = sortedData.map((r, idx) => {
      const inAddr = r.in?.latitude && r.in?.longitude 
        ? `Lat:${r.in.latitude} Lng:${r.in.longitude} Acc:${r.in.accuracy ?? "—"}` 
        : "—";
      const outAddr = r.out?.latitude && r.out?.longitude 
        ? `Lat:${r.out.latitude} Lng:${r.out.longitude} Acc:${r.out.accuracy ?? "—"}` 
        : "—";
      const inBy = r.in?.createdByName ?? "—";
      const outBy = r.out?.createdByName ?? "—";
      
      return [
        idx + 1,
        r.date,
        r.employee.name,
        r.workDuration ?? `${r.workHours.toFixed(2)} hrs`,
        r.workDay,
        r.in?.time ?? "—",
        "", // Placeholder for IN image
        inAddr,
        r.out?.time ?? "—",
        "", // Placeholder for OUT image
        outAddr,
        `IN: ${inBy} | OUT: ${outBy}`,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: y,
      styles: { 
        fontSize: 7, 
        cellPadding: 1.5, 
        minCellHeight: 20,
      },
      headStyles: { 
        fillColor: [66, 139, 202], 
        fontSize: 8, 
        textColor: 255,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      theme: "grid",
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: "auto" },
        2: { cellWidth: "auto" },
        3: { cellWidth: "auto" },
        4: { cellWidth: "auto" },
        5: { cellWidth: "auto" },
        6: { cellWidth: "auto" },
        7: { cellWidth: "auto" },
        8: { cellWidth: "auto" },
        9: { cellWidth: "auto" },
        10: { cellWidth: "auto" },
        11: { cellWidth: "auto" },
      },
      margin: 10,
      didDrawCell: (data: any) => {
        // Draw images in the In Image (column 6) and Out Image (column 9) cells
        if (data.section === "body" && (data.column.index === 6 || data.column.index === 9)) {
          const rowIdx = data.row.index;
          const row = sortedData[rowIdx];
          if (!row) return;

          const isInImage = data.column.index === 6;
          const imageUrl = isInImage ? row.in?.imageUrl : row.out?.imageUrl;
          
          if (imageUrl) {
            const cacheKey = `${isInImage ? "in" : "out"}-${row.date}-${row.employee.id}`;
            const base64Image = imageCache.get(cacheKey);
            
            if (base64Image) {
              const cell = data.cell;
              const imgWidth = 18;
              const imgHeight = 14;
              const x = cell.x + (cell.width - imgWidth) / 2;
              const y = cell.y + (cell.height - imgHeight) / 2;
              
              try {
                doc.addImage(base64Image, "JPEG", x, y, imgWidth, imgHeight);
              } catch {
                // If image fails to load, leave empty
              }
            }
          }
        }
      },
      didDrawPage: (data) => {
        // Add page number at bottom
        const pageCount = (doc as any).internal.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
      },
    });

    doc.save(`employee-attendance-${month}.pdf`);
    toast.success("PDF exported successfully");
  };

  const handleSearch = () => {
    if (!canView) {
      toast.error("You do not have permission to view this report");
      return;
    }
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    const params = new URLSearchParams();
    params.set("month", month);
    if (employeeId) params.set("employeeId", employeeId);
    setQueryUrl(`/api/reports/employee-attendance?${params.toString()}`);
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Employee Attendance Report</AppCard.Title>
        <AppCard.Description>
          Select month and employee, then click Search.
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

            <div>
              <label className="text-xs font-medium">Employee (Optional)</label>
              <div className="mt-1">
                <AppCombobox
                  value={employeeId || undefined}
                  onValueChange={(v) => setEmployeeId(v)}
                  options={employeeOptions}
                  placeholder={employeesLoading ? "Loading..." : "All Employees"}
                  searchPlaceholder="Search employee..."
                  emptyText="No employee found."
                />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <AppButton type="button" onClick={handleSearch} disabled={isLoading || !canView}>
                Search
              </AppButton>
              <AppButton
                type="button"
                onClick={exportPDF}
                disabled={isLoading || !canView || !reportData?.data?.length}
              >
                Export PDF
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
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">Sr.No</th>
                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-foreground uppercase tracking-wider border border-border">Date</th>
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
