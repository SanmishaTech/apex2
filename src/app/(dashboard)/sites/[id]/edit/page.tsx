"use client";

import { use } from "react";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import SiteForm from "../../site-form";
import { Site } from "@/types/sites";

interface EditSitePageProps {
  params: Promise<{ id: string }>;
}

export default function EditSitePage({ params }: EditSitePageProps) {
  const { id } = use(params);
  const siteId = parseInt(id);

  const {
    data: site,
    error,
    isLoading,
  } = useSWR<Site>(
    siteId && !isNaN(siteId) ? `/api/sites/${siteId}` : null,
    apiGet
  );

  if (error) {
    toast.error("Failed to load site data");
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
      mode="edit"
      initial={{
        id: site.id,
        siteCode: site.siteCode ?? undefined,
        site: site.site,
        shortName: site.shortName ?? undefined,
        companyId: site.companyId ?? undefined,
        status: site.status,
        attachCopyUrl: site.attachCopyUrl ?? undefined,
        contactPerson: site.contactPerson ?? undefined,
        contactNo: site.contactNo ?? undefined,
        addressLine1: site.addressLine1 ?? undefined,
        addressLine2: site.addressLine2 ?? undefined,
        stateId: site.stateId ?? undefined,
        cityId: site.cityId ?? undefined,
        pinCode: site.pinCode ?? undefined,
        longitude: site.longitude ?? undefined,
        latitude: site.latitude ?? undefined,
        panNo: site.panNo ?? undefined,
        gstNo: site.gstNo ?? undefined,
        tanNo: site.tanNo ?? undefined,
        cinNo: site.cinNo ?? undefined,
        siteContactPersons: site.siteContactPersons ?? undefined,
      }}
    />
  );
}
