"use client";

import { AppLayout } from "@/components/AppLayout";
import { use } from "react";

interface SeriesLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function SeriesLayout({ children, params }: SeriesLayoutProps) {
  const resolvedParams = use(params);
  return (
    <AppLayout seriesId={resolvedParams.id}>
      {children}
    </AppLayout>
  );
}
