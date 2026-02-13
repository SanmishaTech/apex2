'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatDate } from '@/lib/locales';
import { FormRow, FormSection } from '@/components/common/app-form';

type BoqItem = {
  id: number;
  activityId: string | null;
  clientSrNo: string | null;
  item: string | null;
  unitId: number | null;
  unit: { unitName: string | null } | null;
  qty: string | number | null;
  rate: string | number | null;
  amount: string | number | null;
  orderedQty: string | number | null;
  orderedValue: string | number | null;
  remainingQty: string | number | null;
  remainingValue: string | number | null;
  isGroup: boolean | null;
  billedQty?: number;
};

type BoqDetails = {
  id: number;
  boqNo: string | null;
  siteId: number | null;
  site: { id: number; site: string } | null;
  workName: string | null;
  workOrderNo: string | null;
  workOrderDate: string | null;
  startDate: string | null;
  endDate: string | null;
  totalWorkValue: string | number | null;
  gstRate: string | number | null;
  agreementNo: string | null;
  agreementStatus: string | null;
  completionPeriod: string | null;
  completionDate: string | null;
  dateOfExpiry: string | null;
  commencementDate: string | null;
  timeExtensionDate: string | null;
  defectLiabilityPeriod: string | null;
  performanceSecurityMode: string | null;
  performanceSecurityDocumentNo: string | null;
  performanceSecurityPeriod: string | null;
  createdAt: string;
  updatedAt: string;
  items: BoqItem[];
};

function valueOrDash(v: unknown) {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s ? s : '—';
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="h-9 px-3 flex items-center rounded-md border bg-muted/30 text-muted-foreground">
        <div className="truncate w-full">{value}</div>
      </div>
    </div>
  );
}

export default function ViewBoqPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;
  const [data, setData] = useState<BoqDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.EDIT_BOQS);

  useEffect(() => {
    async function fetchBoq() {
      try {
        if (!id) return;
        const boq = await apiGet<BoqDetails>(`/api/boqs/${id}`);
        setData(boq);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load BOQ');
      } finally {
        setLoading(false);
      }
    }
    fetchBoq();
  }, [id]);

  const rows = useMemo(() => {
    return (data?.items || []).map((it, idx) => ({ ...it, srNo: idx + 1 }));
  }, [data?.items]);

  const columns: Column<(BoqItem & { srNo: number })>[] = [
    {
      key: 'srNo',
      header: 'Sr',
      accessor: (r) => r.srNo,
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'item',
      header: 'Description',
      accessor: (r) => r.item || '—',
      className: 'min-w-[280px]',
    },
    {
      key: 'unit',
      header: 'Unit',
      accessor: (r) => r.unit?.unitName || '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'qty',
      header: 'Qty',
      accessor: (r) => num(r.qty).toFixed(2),
      className: 'whitespace-nowrap text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
    },
    {
      key: 'rate',
      header: 'Rate',
      accessor: (r) => num(r.rate).toFixed(2),
      className: 'whitespace-nowrap text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (r) => num(r.amount).toFixed(2),
      className: 'whitespace-nowrap text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
    },
    {
      key: 'orderedQty',
      header: 'Executed Qty',
      accessor: (r) => num(r.orderedQty).toFixed(2),
      className: 'whitespace-nowrap text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
    },
    {
      key: 'remainingQty',
      header: 'Remaining Qty',
      accessor: (r) => num(r.remainingQty).toFixed(2),
      className: 'whitespace-nowrap text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
    },
  ];

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>BOQ not found</div>;

  return (
    <AppCard>
      <AppCard.Header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <AppCard.Title>BOQ Details</AppCard.Title>
            <AppCard.Description className="truncate">
              {data.boqNo ? `B.O.Q. No.: ${data.boqNo}` : `BOQ #${data.id}`}
              {data.site?.site ? ` • Site: ${data.site.site}` : ''}
            </AppCard.Description>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/boqs">
              <AppButton size="sm" variant="secondary" type="button">
                Back
              </AppButton>
            </Link>
            {canEdit && (
              <Link href={`/boqs/${data.id}/edit`}>
                <AppButton size="sm" type="button">
                  Edit
                </AppButton>
              </Link>
            )}
          </div>
        </div>
      </AppCard.Header>

      <AppCard.Content>
        {data.boqNo ? (
          <div className="mb-4">
            <div className="text-sm font-medium mb-1">B.O.Q. No.</div>
            <div className="h-9 px-3 inline-flex items-center rounded-md border bg-muted/30 text-muted-foreground">
              {data.boqNo}
            </div>
          </div>
        ) : null}

        <FormSection legend={<span className="text-base font-semibold">General</span>}>
          <FormRow cols={1} from="md">
            <ReadOnlyField label="Site *" value={data.site?.site || '—'} />
          </FormRow>
        </FormSection>

        <FormSection legend={<span className="text-base font-semibold">Work Order</span>}>
          <FormRow cols={3} from="md">
            <ReadOnlyField label="Work Order No *" value={valueOrDash(data.workOrderNo)} />
            <ReadOnlyField label="Work Name *" value={valueOrDash(data.workName)} />
            <ReadOnlyField
              label="Work Order Date *"
              value={data.workOrderDate ? formatDate(data.workOrderDate) : '—'}
            />
          </FormRow>
          <FormRow cols={2} from="md">
            <ReadOnlyField
              label="Start Date"
              value={data.startDate ? formatDate(data.startDate) : '—'}
            />
            <ReadOnlyField
              label="End Date"
              value={data.endDate ? formatDate(data.endDate) : '—'}
            />
          </FormRow>
        </FormSection>

        <FormSection legend={<span className="text-base font-semibold">Values &amp; Taxes</span>}>
          <FormRow cols={2} from="md">
            <ReadOnlyField label="Total Work Value" value={valueOrDash(data.totalWorkValue)} />
            <ReadOnlyField label="GST Rate (%)" value={valueOrDash(data.gstRate)} />
          </FormRow>
        </FormSection>

        <FormSection legend={<span className="text-base font-semibold">Agreement</span>}>
          <FormRow cols={2} from="md">
            <ReadOnlyField label="Agreement No" value={valueOrDash(data.agreementNo)} />
            <ReadOnlyField label="Agreement Status" value={valueOrDash(data.agreementStatus)} />
          </FormRow>
          <FormRow cols={2} from="md">
            <ReadOnlyField label="Completion Period" value={valueOrDash(data.completionPeriod)} />
            <ReadOnlyField
              label="Completion Date"
              value={data.completionDate ? formatDate(data.completionDate) : '—'}
            />
          </FormRow>
          <FormRow cols={3} from="md">
            <ReadOnlyField
              label="Date Of Expiry"
              value={data.dateOfExpiry ? formatDate(data.dateOfExpiry) : '—'}
            />
            <ReadOnlyField
              label="Commencement Date"
              value={data.commencementDate ? formatDate(data.commencementDate) : '—'}
            />
            <ReadOnlyField
              label="Time Extension Date"
              value={data.timeExtensionDate ? formatDate(data.timeExtensionDate) : '—'}
            />
          </FormRow>
        </FormSection>

        <FormSection legend={<span className="text-base font-semibold">Performance Security</span>}>
          <FormRow cols={2} from="md">
            <ReadOnlyField
              label="Defect Liability Period"
              value={valueOrDash(data.defectLiabilityPeriod)}
            />
            <ReadOnlyField
              label="Performance Security Mode"
              value={valueOrDash(data.performanceSecurityMode)}
            />
            <ReadOnlyField
              label="Performance Security Document No"
              value={valueOrDash(data.performanceSecurityDocumentNo)}
            />
            <ReadOnlyField
              label="Performance Security Period"
              value={valueOrDash(data.performanceSecurityPeriod)}
            />
          </FormRow>
        </FormSection>

        <div className="mt-4">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-semibold">Items</div>
              <div className="text-xs text-muted-foreground">Scroll inside the table if there are many items.</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Total items: <span className="font-medium text-foreground">{rows.length}</span>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            loading={false}
            dense
            stickyHeader
            minTableWidth={1100}
            scrollContainerClassName="max-h-[420px] overflow-y-auto"
          />
        </div>
      </AppCard.Content>
    </AppCard>
  );
}
