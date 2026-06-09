import { ManpowerFoodChargesForm } from "../manpower-food-charges-form";

export default function NewManpowerFoodChargesPage() {
  return (
    <div className="py-4 space-y-4">
      <ManpowerFoodChargesForm mode="create" />
    </div>
  );
}
