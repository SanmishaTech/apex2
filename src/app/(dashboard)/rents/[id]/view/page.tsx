'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { AppSelect } from '@/components/common/app-select';
import { formatDate, formatDateForInput } from '@/lib/locales';
import type { Rent } from '@/types/rents';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PAYMENT_METHOD_OPTIONS = ['Cash', 'UPI', 'Bank'] as const;
type PaymentMethodOption = typeof PAYMENT_METHOD_OPTIONS[number];
type PaymentFormState = {
  paymentMethod: '' | PaymentMethodOption;
  utrNumber: string;
  chequeNumber: string;
  chequeDate: string;
  bankDetails: string;
};

function createEmptyPaymentForm(): PaymentFormState {
  return {
    paymentMethod: '',
    utrNumber: '',
    chequeNumber: '',
    chequeDate: '',
    bankDetails: '',
  };
}

export default function ViewRentPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id;
  const [rent, setRent] = useState<Rent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(createEmptyPaymentForm);

  const qs = searchParams ? searchParams.toString() : '';
  const backUrl = qs ? `/rents?${qs}` : '/rents';

  const selectedPaymentMethod = paymentForm.paymentMethod;
  const showUtrField = selectedPaymentMethod === 'UPI';
  const showBankFields = selectedPaymentMethod === 'Bank';

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

  const resetPaymentForm = () => {
    setPaymentForm(createEmptyPaymentForm());
  };

  const openPaymentDialog = () => {
    if (rent) {
      const initialMethod = rent.paymentMethod && PAYMENT_METHOD_OPTIONS.includes(rent.paymentMethod as PaymentMethodOption)
        ? (rent.paymentMethod as PaymentMethodOption)
        : '';
      setPaymentForm({
        paymentMethod: initialMethod,
        utrNumber: rent.utrNumber ?? '',
        chequeNumber: rent.chequeNumber ?? '',
        chequeDate: rent.chequeDate ? formatDateForInput(new Date(rent.chequeDate)) : '',
        bankDetails: rent.bankDetails ?? '',
      });
    } else {
      resetPaymentForm();
    }
    setPaymentDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (updating) return;
    setPaymentDialogOpen(false);
    resetPaymentForm();
  };

  const handleSubmitPayment = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Payment method is required');
      return;
    }

    if (selectedPaymentMethod === 'UPI' && !paymentForm.utrNumber.trim()) {
      toast.error('UTR number is required for UPI payments');
      return;
    }

    if (selectedPaymentMethod === 'Bank') {
      if (!paymentForm.chequeNumber.trim()) {
        toast.error('Cheque number is required for bank payments');
        return;
      }
      if (!paymentForm.chequeDate) {
        toast.error('Cheque date is required for bank payments');
        return;
      }
      if (!paymentForm.bankDetails.trim()) {
        toast.error('Bank details are required for bank payments');
        return;
      }
    }

    setUpdating(true);
    try {
      await apiPatch(`/api/rents/${id}/update-status`, {
        status: 'Paid',
        paymentMethod: selectedPaymentMethod,
        utrNumber:
          showUtrField && paymentForm.utrNumber.trim()
            ? paymentForm.utrNumber.trim()
            : undefined,
        chequeNumber:
          showBankFields && paymentForm.chequeNumber.trim()
            ? paymentForm.chequeNumber.trim()
            : undefined,
        chequeDate: showBankFields ? paymentForm.chequeDate || undefined : undefined,
        bankDetails:
          showBankFields && paymentForm.bankDetails.trim()
            ? paymentForm.bankDetails.trim()
            : undefined,
      });
      toast.success('Rent marked as paid');
      setPaymentDialogOpen(false);
      resetPaymentForm();
      setUpdating(false);
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
    <>
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

          {/* Attached MOM Copy Section */
          }
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Attached MOM Copy</h3>
            {rent.momCopyUrl ? (
              (() => {
                const url = rent.momCopyUrl as string;
                const href = url.startsWith('/uploads/')
                  ? `/api${url}`
                  : url.startsWith('http')
                  ? url
                  : `/api/documents/${url}`;
                return (
                  <a
                href={href}
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
                );
              })()
            ) : (
              <span className="text-muted-foreground text-sm">No document attached</span>
            )}
          </div>

          {/* Rent Documents Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Documents</h3>
            {Array.isArray((rent as any).rentDocuments) && (rent as any).rentDocuments.length > 0 ? (
              <ul className="space-y-2">
                {(rent as any).rentDocuments.map((doc: any) => {
                  const url: string = doc.documentUrl || '';
                  const href = url.startsWith('/uploads/')
                    ? `/api${url}`
                    : url.startsWith('http')
                    ? url
                    : `/api/documents/${url}`;
                  return (
                    <li key={doc.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <div className="truncate">
                        <div className="text-sm font-medium truncate">{doc.documentName || 'Document'}</div>
                      </div>
                      {url ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm whitespace-nowrap"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">No file</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-muted-foreground text-sm">No documents</span>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoField label="Payment Method" value={rent.paymentMethod} />
              <InfoField label="Payment Date" value={rent.paymentDate ? formatDate(rent.paymentDate) : undefined} />
              <InfoField label="UTR Number" value={rent.utrNumber} />
              <InfoField label="Cheque Number" value={rent.chequeNumber} />
              <InfoField label="Cheque Date" value={rent.chequeDate ? formatDate(rent.chequeDate) : undefined} />
              <div className="md:col-span-2 lg:col-span-4">
                <InfoField label="Bank Details" value={rent.bankDetails} />
              </div>
            </div>
          </div>
        </div>
      </AppCard.Content>
      <AppCard.Footer className='justify-end gap-2'>
        {rent.status !== 'Paid' && (
          <AppButton
            onClick={openPaymentDialog}
            disabled={updating}
            variant='default'
          >
            {updating ? 'Processing...' : 'Pay'}
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

    <Dialog open={paymentDialogOpen} onOpenChange={(open) => (open ? setPaymentDialogOpen(true) : handleDialogClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className='space-y-2'>
            <Label htmlFor='paymentMethod'>Payment Method</Label>
            <AppSelect
              value={paymentForm.paymentMethod || undefined}
              onValueChange={(value) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  paymentMethod: (value as PaymentMethodOption) || '',
                  utrNumber: value === 'UPI' ? prev.utrNumber : '',
                  chequeNumber: value === 'Bank' ? prev.chequeNumber : '',
                  chequeDate: value === 'Bank' ? prev.chequeDate : '',
                  bankDetails: value === 'Bank' ? prev.bankDetails : '',
                }))
              }
              placeholder='Select payment method'
              required
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <AppSelect.Item key={option} value={option}>
                  {option}
                </AppSelect.Item>
              ))}
            </AppSelect>
          </div>
          {(showUtrField || showBankFields) && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {showUtrField && (
                <div className='space-y-2'>
                  <Label htmlFor='utrNumber'>UTR Number</Label>
                  <Input
                    id='utrNumber'
                    value={paymentForm.utrNumber}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, utrNumber: e.target.value }))}
                    placeholder='Enter UTR number'
                    required
                  />
                </div>
              )}
              {showBankFields && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='chequeNumber'>Cheque Number</Label>
                    <Input
                      id='chequeNumber'
                      value={paymentForm.chequeNumber}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                      placeholder='Enter cheque number'
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='chequeDate'>Cheque Date</Label>
                    <Input
                      id='chequeDate'
                      type='date'
                      value={paymentForm.chequeDate}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, chequeDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className='space-y-2 md:col-span-2'>
                    <Label htmlFor='bankDetails'>Bank Details</Label>
                    <Textarea
                      id='bankDetails'
                      value={paymentForm.bankDetails}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, bankDetails: e.target.value }))}
                      placeholder='Enter relevant bank details'
                      rows={3}
                      required
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <AppButton variant='secondary' type='button' onClick={handleDialogClose} disabled={updating}>
            Cancel
          </AppButton>
          <AppButton type='button' onClick={handleSubmitPayment} disabled={updating}>
            {updating ? 'Saving...' : 'Confirm Payment'}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
