'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormSection, FormRow } from '@/components/common/app-form';
import { DataTable } from '@/components/common/data-table';
import { toast } from 'sonner';
import { ArrowLeft, Users, MapPin } from 'lucide-react';
import type { AssignedManpowerForTransfer, CreateManpowerTransferRequest } from '@/types/manpower-transfers';
import type { Site } from '@/types/sites';

// API client functions
const apiPost = async (url: string, data: any) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
};

export default function NewManpowerTransferPage() {
  const router = useRouter();
  const { backWithScrollRestore } = useScrollRestoration('manpower-transfers-new');
  
  // Check permissions
  const { loading: pageLoading } = useProtectPage();

  // Form state
  const [formData, setFormData] = useState({
    challanDate: new Date().toISOString().split('T')[0],
    fromSiteId: '',
    toSiteId: '',
    remarks: '',
  });

  const [selectedManpower, setSelectedManpower] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  // Fetch sites
  const { data: sitesData } = useSWR<{ data: Site[] }>('/api/sites', fetcher);

  // Fetch assigned manpower for selected from site
  const { data: manpowerData, isLoading: loadingManpower } = useSWR(
    formData.fromSiteId 
      ? `/api/manpower?isAssigned=true&currentSiteId=${formData.fromSiteId}&page=1&perPage=1000`
      : null,
    fetcher
  );

  const assignedManpower: AssignedManpowerForTransfer[] = manpowerData?.data || [];

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Reset selected manpower when from site changes
    if (field === 'fromSiteId') {
      setSelectedManpower([]);
    }
  };

  // Handle manpower selection
  const toggleManpowerSelection = (manpowerId: number) => {
    setSelectedManpower(prev => 
      prev.includes(manpowerId)
        ? prev.filter(id => id !== manpowerId)
        : [...prev, manpowerId]
    );
  };

  const selectAllManpower = () => {
    setSelectedManpower(assignedManpower.map(m => m.id));
  };

  const clearSelection = () => {
    setSelectedManpower([]);
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!formData.challanDate || !formData.fromSiteId || !formData.toSiteId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.fromSiteId === formData.toSiteId) {
      toast.error('From site and to site cannot be the same');
      return;
    }

    if (selectedManpower.length === 0) {
      toast.error('Please select at least one manpower to transfer');
      return;
    }

    setCreating(true);
    try {
      const request: CreateManpowerTransferRequest = {
        challanDate: formData.challanDate,
        fromSiteId: parseInt(formData.fromSiteId),
        toSiteId: parseInt(formData.toSiteId),
        remarks: formData.remarks || null,
        manpowerIds: selectedManpower,
      };

      await apiPost('/api/manpower-transfers', request);
      toast.success('Manpower transfer created successfully');
      backWithScrollRestore();
    } catch (error: any) {
      console.error('Create transfer error:', error);
      toast.error(error.message || 'Failed to create manpower transfer');
    } finally {
      setCreating(false);
    }
  };

  // Table columns for manpower selection
  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedManpower.length === assignedManpower.length && assignedManpower.length > 0}
          onChange={selectedManpower.length === assignedManpower.length ? clearSelection : selectAllManpower}
          className="rounded border-input"
        />
      ),
      accessor: (row: AssignedManpowerForTransfer) => (
        <input
          type="checkbox"
          checked={selectedManpower.includes(row.id)}
          onChange={() => toggleManpowerSelection(row.id)}
          className="rounded border-input"
        />
      ),
      sortable: false,
    },
    {
      key: 'name',
      header: 'Name',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span className="font-medium">
          {`${row.firstName} ${row.middleName || ''} ${row.lastName}`.trim()}
        </span>
      ),
      sortable: false,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span>{row.manpowerSupplier?.supplierName || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'category',
      header: 'Category',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span>{row.category || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'skillSet',
      header: 'Skill Set',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span>{row.skillSet || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'wage',
      header: 'Wage (₹)',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span>{row.wage ? `₹${parseFloat(row.wage).toFixed(2)}` : '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'mobileNumber',
      header: 'Mobile',
      accessor: (row: AssignedManpowerForTransfer) => (
        <span className="font-mono text-sm">{row.mobileNumber || '-'}</span>
      ),
      sortable: false,
    },
  ];

  if (pageLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const fromSite = sitesData?.data?.find(s => s.id === parseInt(formData.fromSiteId));
  const toSite = sitesData?.data?.find(s => s.id === parseInt(formData.toSiteId));

  return (
    <div className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center gap-4">
            <AppButton variant="ghost" size="sm" onClick={backWithScrollRestore}>
              <ArrowLeft className="h-4 w-4" />
            </AppButton>
            <div>
              <AppCard.Title>Create Manpower Transfer</AppCard.Title>
              <AppCard.Description>
                Transfer assigned manpower from one site to another.
              </AppCard.Description>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content>
          <FormSection title="Transfer Details">
            <FormRow>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Challan Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.challanDate}
                  onChange={(e) => handleInputChange('challanDate', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  From Site <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.fromSiteId}
                  onChange={(e) => handleInputChange('fromSiteId', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select from site</option>
                  {sitesData?.data?.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site} {site.shortName ? `(${site.shortName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </FormRow>

            <FormRow>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  To Site <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.toSiteId}
                  onChange={(e) => handleInputChange('toSiteId', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring"
                  required
                >
                  <option value="">Select to site</option>
                  {sitesData?.data
                    ?.filter(site => site.id.toString() !== formData.fromSiteId)
                    ?.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.site} {site.shortName ? `(${site.shortName})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </FormRow>

            <FormRow>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring"
                  placeholder="Add any additional remarks..."
                />
              </div>
            </FormRow>
          </FormSection>
        </AppCard.Content>
      </AppCard>

      {/* Manpower Selection */}
      {formData.fromSiteId && (
        <AppCard>
          <AppCard.Header>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <AppCard.Title>Select Manpower to Transfer</AppCard.Title>
                  <AppCard.Description>
                    {formData.toSiteId ? (
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-primary">{fromSite?.site}</span>
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                        <span className="font-medium text-primary">{toSite?.site}</span>
                      </span>
                    ) : (
                      "Select destination site above to see available manpower"
                    )}
                  </AppCard.Description>
                </div>
              </div>
              {assignedManpower.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-semibold text-2xl text-primary">{selectedManpower.length}</span>
                    <span className="text-muted-foreground"> / {assignedManpower.length} selected</span>
                  </div>
                  {selectedManpower.length > 0 && (
                    <AppButton
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Clear Selection
                    </AppButton>
                  )}
                  {selectedManpower.length < assignedManpower.length && (
                    <AppButton
                      variant="outline"
                      size="sm"
                      onClick={selectAllManpower}
                    >
                      Select All
                    </AppButton>
                  )}
                </div>
              )}
            </div>
          </AppCard.Header>

          {!formData.toSiteId ? (
            <AppCard.Content>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Select Destination Site</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Please select the destination site above to view and select manpower for transfer.
                </p>
              </div>
            </AppCard.Content>
          ) : (
            <AppCard.Content className="p-0">
              {loadingManpower ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading manpower...</p>
                  </div>
                </div>
              ) : assignedManpower.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Manpower Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    There is no assigned manpower at {fromSite?.site} available for transfer.
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={assignedManpower}
                  loading={false}
                  emptyMessage="No assigned manpower found at the selected site"
                />
              )}
            </AppCard.Content>
          )}
        </AppCard>
      )}

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 -mb-4 mt-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-sm text-muted-foreground">
            {selectedManpower.length > 0 ? (
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span><strong>{selectedManpower.length}</strong> manpower selected for transfer</span>
              </span>
            ) : (
              <span>Select manpower to create transfer</span>
            )}
          </div>
          <div className="flex gap-3">
            <AppButton variant="outline" onClick={backWithScrollRestore} disabled={creating}>
              Cancel
            </AppButton>
            <AppButton 
              onClick={handleSubmit}
              disabled={creating || selectedManpower.length === 0 || !formData.fromSiteId || !formData.toSiteId}
              isLoading={creating}
              className="min-w-[140px]"
            >
              {creating ? 'Creating...' : `Create Transfer (${selectedManpower.length})`}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}
