'use client';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { toast } from '@/lib/toast';

export default function ViewManpowerFoodChargesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data, error, isLoading } = useSWR<any>(
    id ? `/api/manpower-food-charges/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load details');
  }

  const details = data?.manpowerFoodChargesDetails || [];

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>View Manpower Food Charges</AppCard.Title>
        <AppCard.Description>
          {data?.monthYear ? `Details for ${data.monthYear}` : 'Loading details...'}
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-3 text-center font-semibold w-16 border-r border-border">#</th>
                  <th className="p-3 text-left font-semibold border-r border-border">Manpower Full Name</th>
                  <th className="p-3 text-left font-semibold border-r border-border">Aadhar Number</th>
                  <th className="p-3 text-left font-semibold border-r border-border">Mobile Number</th>
                  <th className="p-3 text-right font-semibold border-r border-border">Food Charges 1</th>
                  <th className="p-3 text-right font-semibold">Food Charges 2</th>
                </tr>
              </thead>
              <tbody>
                {details.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No manpower records found.
                    </td>
                  </tr>
                ) : (
                  details.map((d: any, i: number) => {
                    const fullName = d.manpower ? `${d.manpower.firstName} ${d.manpower.lastName || ''}`.trim() : 'Unknown';
                    const aadharNo = d.manpower?.aadharNo || '-';
                    const mobileNo = d.manpower?.mobileNumber || '-';
                    const fc1 = d.foodCharges1 != null ? Number(d.foodCharges1).toFixed(2) : '-';
                    const fc2 = d.foodCharges2 != null ? Number(d.foodCharges2).toFixed(2) : '-';
                    
                    return (
                      <tr key={d.id || i} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 border-r border-border font-medium text-center text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="p-3 border-r border-border font-medium">
                          {fullName}
                        </td>
                        <td className="p-3 border-r border-border">
                          {aadharNo}
                        </td>
                        <td className="p-3 border-r border-border">
                          {mobileNo}
                        </td>
                        <td className="p-3 border-r border-border text-right">
                          {fc1}
                        </td>
                        <td className="p-3 text-right">
                          {fc2}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </AppCard.Content>
      <AppCard.Footer className="justify-end gap-3 border-t">
        <AppButton variant="secondary" onClick={() => router.push('/manpower-food-charges')}>
          Back to List
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
