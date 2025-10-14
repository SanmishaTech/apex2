'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { formatDate } from '@/lib/locales';
import type { Rent } from '@/types/rents';

export default function ViewRentPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id;
  const [rent, setRent] = useState<Rent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const qs = searchParams ? searchParams.toString() : '';
  const backUrl = qs ? `/rents?${qs}` : '/rents';

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await apiGet<Rent>(`/api/rents/${id}`);
        setRent(data);
      } catch (error) {
        toast.error('Failed to load rent details');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      await apiPatch(`/api/rents/${id}/update-status`, { status: 'Paid' });
      toast.success('Rent marked as paid');
      // Redirect to the rents list with highlight parameter
      const redirectUrl = qs ? `/rents?${qs}&highlight=${id}` : `/rents?highlight=${id}`;
      router.push(redirectUrl);
    } catch (error) {
      toast.error('Failed to update status');
      setUpdating(false);
    }
  };

  const InfoField = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
    <div className='space-y-1'>
      <label className='text-sm font-medium text-muted-foreground'>{label}</label>
      <div className='text-base'>{value || '—'}</div>
    </div>
  );

  if (loading) {
    return (
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Rent Details</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          <div className='p-6'>Loading...</div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!rent) {
    return (
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Rent Details</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          <div className='p-6'>Rent not found</div>
        </AppCard.Content>
        <AppCard.Footer className='justify-start'>
          <AppButton
            variant='secondary'
            iconName='ArrowLeft'
            onClick={() => router.push(backUrl)}
          >
            Back
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Rent Registration Details</AppCard.Title>
        <AppCard.Description>View rent registration information</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <div className="space-y-6">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoField label="Site" value={rent.site?.site} />
            <InfoField label="Bill Of Quantity" value={rent.boq?.boqNo} />
            <InfoField label="Rent Category" value={rent.rentalCategory?.rentalCategory} />
            <InfoField label="Rent Type" value={rent.rentType?.rentType} />
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoField label="Owner" value={rent.owner} />
            <InfoField label="Pancard No" value={rent.pancardNo} />
            <InfoField 
              label="Deposit Amount" 
              value={rent.depositAmount ? `₹${Number(rent.depositAmount).toLocaleString('en-IN')}.00` : undefined} 
            />
            <InfoField 
              label="Rent Amount" 
              value={rent.rentAmount ? `₹${Number(rent.rentAmount).toLocaleString('en-IN')}` : undefined} 
            />
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InfoField label="Due Date" value={rent.dueDate ? formatDate(rent.dueDate) : undefined} />
            <div className="md:col-span-3">
              <InfoField label="Description" value={rent.description} />
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <InfoField label="Bank" value={rent.bank} />
              <InfoField label="Branch" value={rent.branch} />
              <InfoField label="Account No" value={rent.accountNo} />
              <InfoField label="Account Name" value={rent.accountName} />
              <InfoField label="IFSC Code" value={rent.ifscCode} />
            </div>
          </div>

          {/* Attached MOM Copy Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Attached MOM Copy</h3>
            {rent.momCopyUrl ? (
              <a
                href={rent.momCopyUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline inline-flex items-center gap-2'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
                  <polyline points='15 3 21 3 21 9' />
                  <line x1='10' y1='14' x2='21' y2='3' />
                </svg>
                View Document
              </a>
            ) : (
              <span className="text-muted-foreground text-sm">No document attached</span>
            )}
          </div>
        </div>
      </AppCard.Content>
      <AppCard.Footer className='justify-end gap-2'>
        {rent.status !== 'Paid' && (
          <AppButton
            onClick={handleUpdateStatus}
            disabled={updating}
            variant='default'
          >
            {updating ? 'Updating...' : 'Paid'}
          </AppButton>
        )}
        <AppButton
          variant='secondary'
          iconName='ArrowLeft'
          onClick={() => router.push(backUrl)}
        >
          Back
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}

// Helper function to get the suffix for rent day
function getRentDaySuffix(day: string): string {
  const dayNum = parseInt(day);
  if (dayNum >= 11 && dayNum <= 13) return 'th';
  const lastDigit = dayNum % 10;
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
