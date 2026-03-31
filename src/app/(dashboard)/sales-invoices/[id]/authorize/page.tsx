"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SalesInvoiceForm } from "../../sales-invoice-form";
import { apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { AppButton } from "@/components/common/app-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

export default function AuthorizeSalesInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Fetch invoice data to check if already authorized
  const { data: invoiceData, mutate } = useSWR<any>(
    !Number.isNaN(id) ? `/api/sales-invoices/${id}` : null,
    apiGet
  );

  if (Number.isNaN(id)) {
    return <div className="p-6 text-red-600">Invalid sales invoice ID.</div>;
  }

  const invoice = invoiceData?.data;
  const isAuthorized = invoice?.authorizedById !== null && invoice?.authorizedById !== undefined;

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      await apiPatch(`/api/sales-invoices/${id}`, {
        statusAction: "authorize",
      });
      toast.success("Sales invoice authorized successfully");
      mutate();
      router.push("/sales-invoices");
    } catch (error: any) {
      toast.error(error?.message || "Failed to authorize sales invoice");
    } finally {
      setIsAuthorizing(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div>
          <h2 className="text-lg font-semibold text-yellow-800">Authorization Review</h2>
          <p className="text-sm text-yellow-700">
            Review the invoice details carefully before authorizing.
          </p>
        </div>
        {!isAuthorized && (
          <AppButton
            size="sm"
            iconName="CheckCircle"
            onClick={() => setShowConfirm(true)}
            disabled={isAuthorizing}
          >
            Authorize Invoice
          </AppButton>
        )}
        {isAuthorized && (
          <div className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
            Already Authorized
          </div>
        )}
      </div>

      <SalesInvoiceForm mode="authorize" id={id} />

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authorize Sales Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to authorize sales invoice{" "}
              <strong>{invoice?.invoiceNumber}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 my-4">
            <p className="text-sm text-yellow-800 font-medium">
              Note: Once authorized, this invoice cannot be edited. Backend validation prevents editing an authorized invoice.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthorize} disabled={isAuthorizing}>
              {isAuthorizing ? "Authorizing..." : "Authorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
