'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type CashbookBudgetData = {
  id: number;
  name: string;
  month: string;
  totalBudget: number;
  approved1By: number | null;
  approved1BudgetAmount: number | null;
  siteId: number;
  boqId: number | null;
  site: { id: number; site: string };
  boq: { id: number; boqNo: string | null } | null;
  budgetItems: Array<{
    id: number;
    cashbookHeadId: number;
    description: string | null;
    amount: number;
    approved1Amount: number | null;
    cashbookHead: { id: number; cashbookHeadName: string };
  }>;
};

export default function Approve1CashbookBudgetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [approved1Remarks, setApproved1Remarks] = useState('');
  
  const { data, isLoading, error, mutate } = useSWR<CashbookBudgetData>(
    params?.id ? `/api/cashbook-budgets/${params.id}` : null,
    apiGet
  );

  // Track approved1 amounts for each item
  const [approved1Amounts, setApproved1Amounts] = useState<Record<number, string>>({});

  // Initialize approved1 amounts with budget amounts on first load
  // This must be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (data?.budgetItems && Object.keys(approved1Amounts).length === 0) {
      const initial: Record<number, string> = {};
      data.budgetItems.forEach(item => {
        // For first approval, use the original amount
        initial[item.id] = String(item.approved1Amount || item.amount);
      });
      setApproved1Amounts(initial);
    }
  }, [data, Object.keys(approved1Amounts).length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Budget not found</div>
      </div>
    );
  }

  const handleApproved1AmountChange = (itemId: number, value: string) => {
    setApproved1Amounts(prev => ({ ...prev, [itemId]: value }));
  };

  const totalApproved1Amount = Object.values(approved1Amounts).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const handleApprove1 = async () => {
    if (!confirm('Proceed with first level approval for this cashbook budget?')) return;

    setSubmitting(true);
    try {
      const budgetItems = data.budgetItems.map(item => ({
        id: item.id,
        approved1Amount: approved1Amounts[item.id] || '0',
      }));

      const response = await fetch(`/api/cashbook-budgets/${data.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve_1',
          approved1Remarks,
          budgetItems,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve budget');
      }

      toast.success('First approval completed successfully');
      if (mutate) {
        await mutate();
      }
      router.push('/cashbook-budgets');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to approve budget');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if already approved
  if (data.approved1By) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">This budget has already received first approval</div>
      </div>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>First Approval - Cashbook Budget</AppCard.Title>
        <AppCard.Description>
          Review and approve budget amounts for {data.name} - {data.month}
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content className="space-y-6">
        {/* Budget Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Budget Name</div>
            <div className="font-medium dark:text-white">{data.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Month</div>
            <div className="font-medium dark:text-white">{data.month}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Site</div>
            <div className="font-medium dark:text-white">{data.site.site}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">BOQ</div>
            <div className="font-medium dark:text-white">{data.boq?.boqNo || 'N/A'}</div>
          </div>
        </div>

        {/* Budget Items Table */}
        <div>
          <h3 className="font-semibold text-lg mb-3 dark:text-white">Cashbook Budget Details</h3>
          <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">Cashbook Head</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">Description</th>
                  <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-medium bg-blue-50 dark:bg-blue-900/20 dark:text-gray-200">Approved 1 Amount</th>
                </tr>
              </thead>
              <tbody>

                {data.budgetItems.map((item) => (
                  <tr key={item.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 border-r dark:border-gray-700 dark:text-gray-200">{item.cashbookHead.cashbookHeadName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border-r dark:border-gray-700">{item.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                      ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 border-r dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={approved1Amounts[item.id] || ''}
                        onChange={(e) => handleApproved1AmountChange(item.id, e.target.value)}
                        className="text-right font-mono dark:bg-gray-900 dark:text-white dark:border-gray-600"
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}

              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-800 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right border-r dark:border-gray-700 dark:text-gray-200">Total Amount</td>
                  <td className="px-4 py-3 text-right font-mono border-r dark:border-gray-700 dark:text-gray-200">
                    ₹{Number(data.totalBudget).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                    ₹{totalApproved1Amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-white">
            <b>Approved 1 Remarks</b>
          </label>
          <Textarea
            value={approved1Remarks}
            onChange={(e) => setApproved1Remarks(e.target.value)}
            placeholder="Enter remarks for first approval"
            rows={4}
            className="w-full dark:bg-gray-900 dark:text-white dark:border-gray-600"
          />
        </div>
      </AppCard.Content>

      <AppCard.Footer className="justify-between">
        <AppButton
          variant="secondary"
          onClick={() => router.back()}
          disabled={submitting}
          iconName="ArrowLeft"
        >
          Back
        </AppButton>
        <div className="space-x-4">
          <AppButton
            variant="secondary"
            onClick={() => router.push('/cashbook-budgets')}
            disabled={submitting}
          >
            Cancel
          </AppButton>
          <AppButton
            onClick={handleApprove1}
            isLoading={submitting}
            disabled={submitting}
          >
            Approve 1
          </AppButton>
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
