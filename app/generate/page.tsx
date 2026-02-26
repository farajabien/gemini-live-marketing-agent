import { GenerateScreen } from "@/components/screens/GenerateScreen";
import { Suspense } from "react";

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GenerateScreen />
    </Suspense>
  );
}
