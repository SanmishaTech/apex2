"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import SiteForm from "@/app/(dashboard)/sites/site-form";
import { Site } from "@/types/sites";

export default function EditSitePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;
  const siteId = id ? parseInt(id) : null;

  const {
    data: site,
    error,
    isLoading,
    mutate,
  } = useSWR<Site>(
    siteId && !isNaN(siteId) ? `/api/sites/${siteId}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load site");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load site. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !site) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const normalizedStatus = useMemo(() => {
    const s = site?.status;
    if (!s) return undefined;
    return s.toString().toUpperCase().replace(/\s+/g, "_");
  }, [site]);

  return (
    <SiteForm
      mode="edit"
      mutate={mutate}
      initial={{
        id: site.id,
        siteCode: site.siteCode ?? undefined,
        site: site.site,
        shortName: site.shortName ?? undefined,
        companyId: site.companyId ?? undefined,
        status: normalizedStatus as any,
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
        deliveryAddresses: site.siteDeliveryAddresses
          ? site.siteDeliveryAddresses.map((a) => ({
              id: a.id,
              addressLine1: a.addressLine1 ?? "",
              addressLine2: a.addressLine2 ?? "",
              stateId: a.stateId ?? null,
              cityId: a.cityId ?? null,
              pinCode: a.pinCode ?? "",
            }))
          : undefined,
      }}
      redirectOnSuccess="/sites"
    />
  );
}
