import { AppLayout } from "@/components/AppLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - AI Marketing Assistant",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
