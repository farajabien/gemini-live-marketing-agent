"use client";

import { AppLayout } from "@/components/AppLayout";
import { Metadata } from "next";

export default function MediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
