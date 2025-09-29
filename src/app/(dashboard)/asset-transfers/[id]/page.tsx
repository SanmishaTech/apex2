'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { AssetTransfer } from '@/types/asset-transfers';
import useSWR from 'swr';
import { AppCard } from '@/components/common/app-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ViewAssetTransferPageProps {
  params: Promise<{ id: string }>;
}

export default function ViewAssetTransferPage({ params }: ViewAssetTransferPageProps) {
  useProtectPage();
  
  const router = useRouter();
  const { id } = React.use(params);
  const transferId = parseInt(id, 10);

  const { data: assetTransfer, error, isLoading } = useSWR<AssetTransfer>(
    `/api/asset-transfers/${transferId}`,
    fetcher
  );

  const handleBack = () => {
    router.push('/asset-transfers');
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-red-600">
              Failed to load asset transfer. Please try again.
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center">Loading asset transfer...</div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (!assetTransfer) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-red-600">
              Asset transfer not found.
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  const statusColors = {
    "Pending": "bg-yellow-100 text-yellow-800",
    "Accepted": "bg-green-100 text-green-800", 
    "Rejected": "bg-red-100 text-red-800",
  };

  return (
    <div className="container mx-auto py-6">
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Asset Transfer Details</h1>
                <p className="text-muted-foreground">
                  Challan No: {assetTransfer.challanNo}
                </p>
              </div>
            </div>
            <Badge 
              variant="secondary"
              className={statusColors[assetTransfer.status as keyof typeof statusColors]}
            >
              {assetTransfer.status}
            </Badge>
          </div>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {/* Transfer Details */}
          <FormSection legend="Transfer Details">
            <FormRow cols={3}>
              <div className="space-y-2">
                <Label>Transfer Type</Label>
                <div className="p-2 bg-gray-50 rounded border">
                  <Badge variant={assetTransfer.transferType === 'New Assign' ? 'default' : 'secondary'}>
                    {assetTransfer.transferType}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Challan Date</Label>
                <div className="p-2 bg-gray-50 rounded border">
                  {new Date(assetTransfer.challanDate).toLocaleDateString()}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Created Date</Label>
                <div className="p-2 bg-gray-50 rounded border">
                  {new Date(assetTransfer.createdAt).toLocaleDateString()}
                </div>
              </div>
            </FormRow>

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label>From Site</Label>
                <div className="p-2 bg-gray-50 rounded border">
                  {assetTransfer.fromSite?.site || 'N/A (New Assignment)'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>To Site</Label>
                <div className="p-2 bg-gray-50 rounded border">
                  {assetTransfer.toSite?.site}
                </div>
              </div>
            </FormRow>
          </FormSection>

          {/* Asset Details */}
          <FormSection legend={`Selected Assets (${assetTransfer.transferItems?.length || 0})`}>
            <div className="space-y-3">
              {assetTransfer.transferItems?.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-blue-600">{item.asset?.assetNo}</span>
                      <span className="mx-2">-</span>
                      <span className="font-medium">{item.asset?.assetName}</span>
                      {item.asset?.make && (
                        <span className="text-gray-600 ml-2">({item.asset.make})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.asset?.assetGroup?.assetGroupName} / {item.asset?.assetCategory?.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          {/* Approval Details */}
          {(assetTransfer.status !== 'Pending' || assetTransfer.approvedAt) && (
            <FormSection legend="Approval Details">
              <FormRow cols={2}>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="p-2 bg-gray-50 rounded border">
                    <Badge 
                      variant="secondary"
                      className={statusColors[assetTransfer.status as keyof typeof statusColors]}
                    >
                      {assetTransfer.status}
                    </Badge>
                  </div>
                </div>
                {assetTransfer.approvedAt && (
                  <div className="space-y-2">
                    <Label>Approved Date</Label>
                    <div className="p-2 bg-gray-50 rounded border">
                      {new Date(assetTransfer.approvedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </FormRow>
              {assetTransfer.approvedBy && (
                <FormRow>
                  <div className="space-y-2">
                    <Label>Approved By</Label>
                    <div className="p-2 bg-gray-50 rounded border">
                      {assetTransfer.approvedBy.name || assetTransfer.approvedBy.email}
                    </div>
                  </div>
                </FormRow>
              )}
            </FormSection>
          )}

          {/* File Attachment */}
          {assetTransfer.challanCopyUrl && (
            <FormSection legend="Challan Copy">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="flex-1">Challan Copy</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(assetTransfer.challanCopyUrl, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </FormSection>
          )}

          {/* Remarks */}
          {assetTransfer.remarks && (
            <FormSection legend="Remarks">
              <div className="p-3 bg-gray-50 rounded border">
                {assetTransfer.remarks}
              </div>
            </FormSection>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
