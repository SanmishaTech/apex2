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
  siteId: number;
  boqId: number | null;
  approvedBy: number | null;
  approved1By: number | null;
  approved1BudgetAmount: number | null;
  approved1Remarks: string | null;
  site: { id: number; site: string };
  boq: { id: number; boqNo: string | null } | null;
  budgetItems: Array<{
    id: number;
    cashbookHeadId: number;
    description: string | null;
    amount: number;
    approved1Amount: number | null;
    approvedAmount: number | null;
    cashbookHead: { id: number; cashbookHeadName: string };
  }>;
};

export default function ApproveCashbookBudgetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [approvedRemarks, setApprovedRemarks] = useState('');
  
  const { data, isLoading, error, mutate } = useSWR<CashbookBudgetData>(
    params?.id ? `/api/cashbook-budgets/${params.id}` : null,
    apiGet
  );

  // Track approved amounts for each item
  const [approvedAmounts, setApprovedAmounts] = useState<Record<number, string>>({});

  // Initialize approved amounts with approved1 amounts on first load
  // This must be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (data?.budgetItems && Object.keys(approvedAmounts).length === 0) {
      const initial: Record<number, string> = {};
      data.budgetItems.forEach(item => {
        // For second approval, default to approved1Amount
        initial[item.id] = String(item.approvedAmount || item.approved1Amount || item.amount);
      });
      setApprovedAmounts(initial);
    }
  }, [data, Object.keys(approvedAmounts).length]);

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

  const handleApprovedAmountChange = (itemId: number, value: string) => {
    setApprovedAmounts(prev => ({ ...prev, [itemId]: value }));
  };

  const totalApprovedAmount = Object.values(approvedAmounts).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const handleApprove = async () => {
    if (!confirm('Proceed with final approval for this cashbook budget?')) return;

    setSubmitting(true);
    try {
      const budgetItems = data.budgetItems.map(item => ({
        id: item.id,
        approvedAmount: approvedAmounts[item.id] || '0',
      }));

      const response = await fetch(`/api/cashbook-budgets/${data.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve',
          approvedRemarks,
          budgetItems,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve budget');
      }

      toast.success('Final approval completed successfully');
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

  // Validation checks
  if (!data.approved1By) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">This budget must receive first approval before final approval</div>
      </div>
    );
  }
  
  if (data.approvedBy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">This budget has already received final approval</div>
      </div>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Final Approval - Cashbook Budget</AppCard.Title>
        <AppCard.Description>
          Review and finalize budget amounts for {data.name} - {data.month}
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

        {/* Display Approved 1 Remarks if exists */}
        {data.approved1Remarks && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 dark:border dark:border-blue-800 rounded-lg">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-1">First Approval Remarks</div>
            <div className="text-sm text-blue-700 dark:text-blue-300">{data.approved1Remarks}</div>
          </div>
        )}

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
                  <th className="px-4 py-3 text-right text-sm font-medium border-r dark:border-gray-700 dark:text-gray-200">Approved 1 Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-medium bg-green-50 dark:bg-green-900/20 dark:text-gray-200">Approved Amount</th>
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
                    <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 border-r dark:border-gray-700">
                      ₹{Number(item.approved1Amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 bg-green-50 dark:bg-green-900/20">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={approvedAmounts[item.id] || ''}
                        onChange={(e) => handleApprovedAmountChange(item.id, e.target.value)}
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
                  <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 border-r dark:border-gray-700">
                    ₹{Number(data.approved1BudgetAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                    ₹{totalApprovedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Final Approval Remarks */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-white">
            <b>Remarks for Final Approval</b>
          </label>
          <Textarea
            value={approvedRemarks}
            onChange={(e) => setApprovedRemarks(e.target.value)}
            placeholder="Enter remarks for final approval"
            rows={4}
            className="w-full dark:bg-gray-900 dark:text-white dark:border-gray-600"
          />
        </div>
      </AppCard.Content>

      <AppCard.Footer className="justify-end space-x-4">
        <AppButton
          variant="secondary"
          onClick={() => router.push('/cashbook-budgets')}
          disabled={submitting}
        >
          Cancel
        </AppButton>
        <AppButton
          onClick={handleApprove}
          isLoading={submitting}
          disabled={submitting}
          className="bg-green-600 hover:bg-green-700"
        >
          Approve
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
