'use client';

import { use, useEffect, useState } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/locales';
import { AppButton } from '@/components/common/app-button';
import { useRouter } from 'next/navigation';

type PdfViewPageProps = {
  params: Promise<{ siteId: string }>;
};

type SiteBudgetItem = {
  id: number;
  siteId: number;
  itemId: number;
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
  createdAt: string;
  updatedAt: string;
  item: {
    id: number;
    item: string;
    itemCode: string;
    unit: {
      id: number;
      unitName: string;
    } | null;
  };
};

type SiteBudgetsResponse = {
  data: SiteBudgetItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function SiteBudgetPdfPage({ params }: PdfViewPageProps) {
  const { siteId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all budget data for the site
  const { data: budgetData, error } = useSWR<SiteBudgetsResponse>(
    `/api/site-budgets?siteId=${siteId}&perPage=1000`,
    apiGet
  );

  // Fetch site details
  const { data: site } = useSWR(`/api/sites/${siteId}`, apiGet) as { data: any };

  // Get company info from site data
  const company = site?.company;

  useEffect(() => {
    if (budgetData && site) {
      setIsLoading(false);
    }
  }, [budgetData, site]);

  useEffect(() => {
    // Auto-print when component loads
    const timer = setTimeout(() => {
      if (!isLoading) {
        window.print();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (error) {
    toast.error('Failed to load budget data');
    return <div>Error loading data</div>;
  }

  if (isLoading || !budgetData || !site) {
    return <div>Loading...</div>;
  }

  // Calculate totals
  const totalBudgetValue = budgetData.data.reduce((sum, item) => sum + Number(item.budgetValue), 0);
  const totalOrderedValue = budgetData.data.reduce((sum, item) => sum + Number(item.orderedValue), 0);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { 
            width: 100%; 
            height: 100vh; 
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
        }
        
        @media screen {
          .print-page {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
        
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 12px;
        }
        
        .report-table th,
        .report-table td {
          border: 1px solid #000;
          padding: 8px 4px;
          text-align: center;
          vertical-align: middle;
        }
        
        .report-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        .report-table .text-left {
          text-align: left;
        }
        
        .report-table .text-right {
          text-align: right;
        }
        
        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }
        
        .grand-total-row {
          font-weight: bold;
          background-color: #e9e9e9;
        }
        
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          border: 2px solid #000;
          padding: 10px;
        }
        
        .company-info {
          flex: 1;
        }
        
        .report-title {
          flex: 1;
          text-align: right;
          font-size: 18px;
          font-weight: bold;
        }
        
        .site-info {
          margin: 10px 0;
          font-weight: bold;
        }
        
        .footer-info {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          font-size: 10px;
        }
      `}</style>

      <div className="print-page">
        {/* No Print Controls */}
        <div className="no-print mb-4 flex gap-2">
          <AppButton onClick={() => window.print()} iconName="Printer">
            Print PDF
          </AppButton>
          <AppButton variant="secondary" onClick={() => router.back()} iconName="ArrowLeft">
            Back
          </AppButton>
        </div>

        {/* Header Section */}
        <div className="header-section">
          <div className="company-info">
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {company?.company || 'ABCD COMPANY LTD'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Report: Budget View
            </div>
          </div>
          <div className="report-title">
            APEX Constructions
          </div>
        </div>

        {/* Site Information */}
        <div className="site-info">
          Site: {site.site}
        </div>

        {/* Budget Table */}
        <table className="report-table">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Item</th>
              <th style={{ width: '8%' }}>Unit</th>
              <th style={{ width: '10%' }}>Budget Qty</th>
              <th style={{ width: '12%' }}>Budget Rate</th>
              <th style={{ width: '12%' }}>Budget Value</th>
              <th style={{ width: '10%' }}>Ordered Qty</th>
              <th style={{ width: '11%' }}>Avg Rate</th>
              <th style={{ width: '12%' }}>Ordered Value</th>
            </tr>
          </thead>
          <tbody>
            {budgetData.data.map((item) => (
              <tr key={item.id}>
                <td className="text-left">{item.item.item}</td>
                <td>{item.item.unit?.unitName || '-'}</td>
                <td className="text-right">{Number(item.budgetQty).toFixed(2)}</td>
                <td className="text-right">{Number(item.budgetRate).toFixed(2)}</td>
                <td className="text-right">{Number(item.budgetValue).toFixed(2)}</td>
                <td className="text-right">{Number(item.orderedQty).toFixed(2)}</td>
                <td className="text-right">{Number(item.avgRate).toFixed(2)}</td>
                <td className="text-right">{Number(item.orderedValue).toFixed(2)}</td>
              </tr>
            ))}
            
            {/* Total Row */}
            <tr className="total-row">
              <td colSpan={4} className="text-right">Total</td>
              <td className="text-right">{totalBudgetValue.toFixed(2)}</td>
              <td></td>
              <td></td>
              <td className="text-right">{totalOrderedValue.toFixed(2)}</td>
            </tr>
            
            {/* Grand Total Row */}
            <tr className="grand-total-row">
              <td colSpan={4} className="text-right">Grand Total</td>
              <td className="text-right">{totalBudgetValue.toFixed(2)}</td>
              <td></td>
              <td></td>
              <td className="text-right">{totalOrderedValue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="footer-info">
          <div>APEX</div>
          <div>Printed on {formattedDate} {formattedTime}</div>
          <div>1/1</div>
        </div>
      </div>
    </>
  );
}
