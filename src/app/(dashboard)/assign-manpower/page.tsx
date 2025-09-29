'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AppCard } from '@/components/common/app-card';
import { FormSection, FormRow } from '@/components/common/app-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { toast } from '@/lib/toast';
import { apiPost } from '@/lib/api-client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AssignManpowerPage() {
  useProtectPage();
  
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedManpower, setSelectedManpower] = useState<number[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data
  const { data: sitesData } = useSWR('/api/sites?perPage=100', fetcher);
  const { data: suppliersData } = useSWR('/api/manpower-suppliers?perPage=100', fetcher);
  
  const manpowerQuery = `perPage=100&isAssigned=false${supplierId ? `&supplierId=${supplierId}` : ''}`;
  const { data: manpowerData, mutate } = useSWR(`/api/manpower?${manpowerQuery}`, fetcher);

  const sites = sitesData?.data || [];
  const suppliers = suppliersData?.data || [];
  const manpower = manpowerData?.data || [];

  const handleAssign = async () => {
    if (!selectedSiteId || selectedManpower.length === 0) {
      toast.error('Please select site and manpower');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/api/manpower-assignments', {
        siteId: selectedSiteId,
        manpowerIds: selectedManpower,
      });
      toast.success('Manpower assigned successfully');
      setSelectedManpower([]);
      mutate();
    } catch (error) {
      toast.error('Failed to assign manpower');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppCard>
      <AppCard.Header>
        <h1 className="text-2xl font-bold">Assign Manpowers for Dhanbad Station</h1>
      </AppCard.Header>

      <AppCard.Content className="space-y-6">
        <FormSection legend="Filters">
          <FormRow cols={2}>
            <div>
              <Label>Manpower Supplier</Label>
              <Select value={supplierId?.toString() || 'all'} onValueChange={(v) => setSupplierId(v === 'all' ? null : parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.supplierName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={selectedSiteId?.toString() || ''} onValueChange={(v) => setSelectedSiteId(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.site}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormRow>
        </FormSection>

        <FormSection legend="Available Manpower">
          <div className="space-y-2">
            {manpower.map((m: any) => (
              <div key={m.id} className="flex items-center space-x-2 p-2 border rounded">
                <Checkbox
                  checked={selectedManpower.includes(m.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedManpower(prev => [...prev, m.id]);
                    } else {
                      setSelectedManpower(prev => prev.filter(id => id !== m.id));
                    }
                  }}
                />
                <span>{m.firstName} {m.lastName}</span>
                <span className="text-sm text-gray-500">({m.manpowerSupplier?.supplierName})</span>
              </div>
            ))}
          </div>
        </FormSection>
      </AppCard.Content>

      <AppCard.Footer>
        <Button onClick={handleAssign} disabled={isSubmitting}>
          {isSubmitting ? 'Assigning...' : `Assign ${selectedManpower.length} Manpower`}
        </Button>
      </AppCard.Footer>
    </AppCard>
  );
}
