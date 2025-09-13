'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import SiteForm from '../../site-form';
import { Site } from '@/types/sites';

interface EditSitePageProps {
  params: Promise<{ id: string }>;
}

export default function EditSitePage({ params }: EditSitePageProps) {
  const { id } = use(params);
  const siteId = parseInt(id);

  const { data: site, error, isLoading } = useSWR<Site>(
    siteId && !isNaN(siteId) ? `/api/sites/${siteId}` : null,
    apiGet
  );

  if (error) {
    toast.error('Failed to load site data');
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-destructive">Failed to load site data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Site not found</p>
        </div>
      </div>
    );
  }

  return (
    <SiteForm
      mode='edit'
      initial={{
        id: site.id,
        uinNo: site.uinNo,
        site: site.site,
        shortName: site.shortName,
        companyId: site.companyId,
        closed: site.closed,
        permanentClosed: site.permanentClosed,
        monitor: site.monitor,
        attachCopyUrl: site.attachCopyUrl,
        contactPerson: site.contactPerson,
        contactNo: site.contactNo,
        addressLine1: site.addressLine1,
        addressLine2: site.addressLine2,
        stateId: site.stateId,
        cityId: site.cityId,
        pinCode: site.pinCode,
        longitude: site.longitude,
        latitude: site.latitude,
        panNo: site.panNo,
        gstNo: site.gstNo,
        tanNo: site.tanNo,
        cinNo: site.cinNo,
      }}
    />
  );
}
