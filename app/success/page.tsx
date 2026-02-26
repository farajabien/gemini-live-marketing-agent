import { SuccessScreen } from "@/components/screens/SuccessScreen";
import { Suspense } from "react";

export default async function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[#f6f6f8] dark:bg-[#101322] flex items-center justify-center">Loading...</div>}>
      <SuccessScreen />
    </Suspense>
  );
}
