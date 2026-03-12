"use client";

import { AppLayout } from "@/components/AppLayout";
import { use, Suspense } from "react";

interface SeriesLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function SeriesLayout({ children, params }: SeriesLayoutProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AppLayout seriesId={resolvedParams.id} noPadding>
        {children}
      </AppLayout>
    </Suspense>
  );
}
