'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { z } from 'zod';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

// Types
interface BudgetItem {
  id?: number;
  itemId: number;
  item?: {
    id: number;
    item: string;
    itemCode: string;
    unit?: {
      id: number;
      unitName: string;
    };
  };
  budgetQty: number;
  budgetRate: number;
  purchaseRate: number;
  budgetValue: number;
  orderedQty: number;
  avgRate: number;
  orderedValue: number;
  qty50Alert: boolean;
  value50Alert: boolean;
  qty75Alert: boolean;
  value75Alert: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface InlineBudgetManagerProps {
  siteId: number;
}

const budgetItemSchema = z.object({
  itemId: z.number().min(1, 'Item is required'),
  budgetQty: z.number().min(0.01, 'Budget Qty must be greater than 0'),
  budgetRate: z.number().min(0.01, 'Budget Rate must be greater than 0'),
  purchaseRate: z.number().min(0.01, 'Purchase Rate must be greater than 0'),
  qty50Alert: z.boolean(),
  value50Alert: z.boolean(),
  qty75Alert: z.boolean(),
  value75Alert: z.boolean(),
});

export function InlineBudgetManager({ siteId }: InlineBudgetManagerProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch site data
  const { data: site } = useSWR(`/api/sites/${siteId}`, apiGet) as { data: any };
  
  // Fetch items for dropdown
  const { data: itemsData } = useSWR('/api/items?perPage=1000', apiGet) as { data: any };
  const items = itemsData?.data || [];

  // Fetch existing budget items for this site
  const { data: existingBudgets, mutate: mutateBudgets } = useSWR(
    `/api/site-budgets?siteId=${siteId}&perPage=1000`,
    apiGet
  ) as { data: any; mutate: () => Promise<any> };

  // Initialize budget items from existing data
  useEffect(() => {
    if (existingBudgets && !isInitialized) {
      if (existingBudgets.data && existingBudgets.data.length > 0) {
        const formattedItems: BudgetItem[] = existingBudgets.data.map((item: any) => ({
          id: item.id,
          itemId: item.itemId,
          item: item.item,
          budgetQty: Number(item.budgetQty),
          budgetRate: Number(item.budgetRate),
          purchaseRate: Number(item.purchaseRate),
          budgetValue: Number(item.budgetValue),
          orderedQty: Number(item.orderedQty),
          avgRate: Number(item.avgRate),
          orderedValue: Number(item.orderedValue),
          qty50Alert: item.qty50Alert,
          value50Alert: item.value50Alert,
          qty75Alert: item.qty75Alert,
          value75Alert: item.value75Alert,
          isNew: false,
          isDeleted: false,
        }));
        setBudgetItems(formattedItems);
      } else {
        // If no existing budgets, start with one empty row
        const newItem: BudgetItem = {
          id: Date.now(),
          itemId: 0,
          budgetQty: 0,
          budgetRate: 0,
          purchaseRate: 0,
          budgetValue: 0,
          orderedQty: 0,
          avgRate: 0,
          orderedValue: 0,
          qty50Alert: false,
          value50Alert: false,
          qty75Alert: false,
          value75Alert: false,
          isNew: true,
          isDeleted: false,
        };
        setBudgetItems([newItem]);
      }
      setIsInitialized(true);
    }
  }, [existingBudgets, isInitialized]);

  const addNewRow = () => {
    const newItem: BudgetItem = {
      id: Date.now(), // Use timestamp as temporary ID for new items
      itemId: 0,
      budgetQty: 0,
      budgetRate: 0,
      purchaseRate: 0,
      budgetValue: 0,
      orderedQty: 0,
      avgRate: 0,
      orderedValue: 0,
      qty50Alert: false,
      value50Alert: false,
      qty75Alert: false,
      value75Alert: false,
      isNew: true,
      isDeleted: false,
    };
    setBudgetItems(prev => [...prev, newItem]);
  };

  const removeRow = (visibleIndex: number) => {
    setBudgetItems(prev => {
      const newItems = [...prev];
      // Find the actual index in the full array, not the filtered array
      const visibleItems = prev.filter(item => !item.isDeleted);
      const actualIndex = prev.indexOf(visibleItems[visibleIndex]);
      
      if (actualIndex !== -1) {
        if (newItems[actualIndex].id) {
          // Mark existing item as deleted
          newItems[actualIndex].isDeleted = true;
        } else {
          // Remove new item completely
          newItems.splice(actualIndex, 1);
        }
      }
      return newItems;
    });
  };

  const updateItem = (originalIndex: number, field: keyof BudgetItem, value: any) => {
    setBudgetItems(prev => {
      const newItems = [...prev];
      // Find the actual index in the full array, not the filtered array
      const visibleItems = prev.filter(item => !item.isDeleted);
      const actualIndex = prev.indexOf(visibleItems[originalIndex]);
      
      if (actualIndex !== -1) {
        newItems[actualIndex] = { ...newItems[actualIndex], [field]: value };
        
        // Recalculate values
        if (field === 'budgetQty' || field === 'budgetRate') {
          newItems[actualIndex].budgetValue = newItems[actualIndex].budgetQty * newItems[actualIndex].budgetRate;
        }
      }
      
      return newItems;
    });

    // Clear errors for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[originalIndex]) {
        delete newErrors[originalIndex][field];
        if (Object.keys(newErrors[originalIndex]).length === 0) {
          delete newErrors[originalIndex];
        }
      }
      return newErrors;
    });
  };

  const validateItems = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;

    budgetItems.forEach((item, index) => {
      if (item.isDeleted) return;

      try {
        budgetItemSchema.parse({
          itemId: item.itemId,
          budgetQty: item.budgetQty,
          budgetRate: item.budgetRate,
          purchaseRate: item.purchaseRate,
          qty50Alert: item.qty50Alert,
          value50Alert: item.value50Alert,
          qty75Alert: item.qty75Alert,
          value75Alert: item.value75Alert,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          newErrors[index] = {};
          error.errors.forEach(err => {
            if (err.path[0]) {
              newErrors[index][err.path[0] as string] = err.message;
              hasErrors = true;
            }
          });
        }
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const saveChanges = async () => {
    if (!validateItems()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const operations: Promise<unknown>[] = [];

      for (const item of budgetItems) {
        if (item.isDeleted && item.id && !item.isNew) {
          // Delete existing item (only if it has a real database ID)
          operations.push(apiDelete(`/api/site-budgets/${item.id}`));
        } else if (item.isNew && !item.isDeleted) {
          // Create new item
          const payload = {
            siteId,
            itemId: item.itemId,
            budgetQty: item.budgetQty,
            budgetRate: item.budgetRate,
            purchaseRate: item.purchaseRate,
            qty50Alert: item.qty50Alert,
            value50Alert: item.value50Alert,
            qty75Alert: item.qty75Alert,
            value75Alert: item.value75Alert,
          };
          operations.push(apiPost('/api/site-budgets', payload));
        } else if (item.id && !item.isDeleted && !item.isNew) {
          // Update existing item (only if it has a real database ID)
          const payload = {
            itemId: item.itemId,
            budgetQty: item.budgetQty,
            budgetRate: item.budgetRate,
            purchaseRate: item.purchaseRate,
            qty50Alert: item.qty50Alert,
            value50Alert: item.value50Alert,
            qty75Alert: item.qty75Alert,
            value75Alert: item.value75Alert,
          };
          operations.push(apiPatch(`/api/site-budgets/${item.id}`, payload));
        }
      }

      // Execute all operations
      await Promise.all(operations);
      
      toast.success('Budget items saved successfully');
      
      // Refresh data and navigate back
      await mutateBudgets();
      router.push('/site-budgets');
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save budget items');
    } finally {
      setSaving(false);
    }
  };

  const getItemUnit = (itemId: number) => {
    const item = items.find((i: any) => i.id === itemId);
    return item?.unit?.unitName || '';
  };

  const visibleItems = budgetItems.filter(item => !item.isDeleted);

  if (!can(PERMISSIONS.CREATE_SITE_BUDGETS)) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className="text-center py-8">
            <p className="text-muted-foreground">You don't have permission to manage site budgets.</p>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          Add Budget for {site?.site || 'Site'}
        </AppCard.Title>
        <AppCard.Description>
          Add, edit, or remove budget items. Use the + button to add new rows and - button to remove rows.
        </AppCard.Description>
      </AppCard.Header>
      
      <AppCard.Content>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left text-sm font-medium dark:text-gray-200">Item</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Unit</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Budget Qty</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Budget Rate</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Purchase Rate</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Budget Value</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Ordered Qty</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Avg Rate</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Ordered Value</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">50 Qty Alert</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">75 Qty Alert</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">50 Value Alert</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">75 Value Alert</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center text-sm font-medium dark:text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={item.id || `new-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <select
                      value={item.itemId}
                      onChange={(e) => updateItem(index, 'itemId', parseInt(e.target.value))}
                      className={`w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 dark:text-gray-200 ${
                        errors[index]?.itemId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <option value={0}>Select Item</option>
                      {items.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.itemCode} - {i.item}
                        </option>
                      ))}
                    </select>
                    {errors[index]?.itemId && (
                      <div className="text-red-500 text-xs mt-1">{errors[index].itemId}</div>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center text-sm dark:text-gray-200">
                    {getItemUnit(item.itemId)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <input
                      type="number"
                      value={item.budgetQty}
                      onChange={(e) => updateItem(index, 'budgetQty', parseFloat(e.target.value) || 0)}
                      className={`w-full px-2 py-1 text-sm border rounded text-right bg-white dark:bg-gray-800 dark:text-gray-200 ${
                        errors[index]?.budgetQty ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      step="0.01"
                    />
                    {errors[index]?.budgetQty && (
                      <div className="text-red-500 text-xs mt-1">{errors[index].budgetQty}</div>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <input
                      type="number"
                      value={item.budgetRate}
                      onChange={(e) => updateItem(index, 'budgetRate', parseFloat(e.target.value) || 0)}
                      className={`w-full px-2 py-1 text-sm border rounded text-right bg-white dark:bg-gray-800 dark:text-gray-200 ${
                        errors[index]?.budgetRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      step="0.01"
                    />
                    {errors[index]?.budgetRate && (
                      <div className="text-red-500 text-xs mt-1">{errors[index].budgetRate}</div>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <input
                      type="number"
                      value={item.purchaseRate}
                      onChange={(e) => updateItem(index, 'purchaseRate', parseFloat(e.target.value) || 0)}
                      className={`w-full px-2 py-1 text-sm border rounded text-right bg-white dark:bg-gray-800 dark:text-gray-200 ${
                        errors[index]?.purchaseRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      step="0.01"
                    />
                    {errors[index]?.purchaseRate && (
                      <div className="text-red-500 text-xs mt-1">{errors[index].purchaseRate}</div>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right text-sm font-medium dark:text-gray-200">
                    {item.budgetValue.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <div className="text-right text-sm dark:text-gray-200">
                      {item.orderedQty.toFixed(2)}
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <div className="text-right text-sm dark:text-gray-200">
                      {item.avgRate.toFixed(2)}
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right text-sm font-medium dark:text-gray-200">
                    {item.orderedValue.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={item.qty50Alert}
                      onChange={(e) => updateItem(index, 'qty50Alert', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={item.qty75Alert}
                      onChange={(e) => updateItem(index, 'qty75Alert', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={item.value50Alert}
                      onChange={(e) => updateItem(index, 'value50Alert', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={item.value75Alert}
                      onChange={(e) => updateItem(index, 'value75Alert', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="w-6 h-6 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                        title="Remove row"
                      >
                        -
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex justify-start">
          <button
            type="button"
            onClick={addNewRow}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <span className="font-bold">+</span>
            Add Row
          </button>
        </div>
      </AppCard.Content>

      <AppCard.Footer className="justify-end">
        <AppButton
          type="button"
          variant="secondary"
          onClick={() => router.push('/site-budgets')}
          disabled={saving}
          iconName="X"
        >
          Cancel
        </AppButton>
        <AppButton
          type="button"
          onClick={saveChanges}
          iconName="Save"
          isLoading={saving}
          disabled={saving || visibleItems.length === 0}
        >
          Save
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
