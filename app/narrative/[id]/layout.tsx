"use client";

import { AppLayout } from "@/components/AppLayout";
import { use } from "react";

interface NarrativeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function NarrativeLayout({ children, params }: NarrativeLayoutProps) {
  const resolvedParams = use(params);
  return (
    <AppLayout narrativeId={resolvedParams.id}>
      {children}
    </AppLayout>
  );
}
