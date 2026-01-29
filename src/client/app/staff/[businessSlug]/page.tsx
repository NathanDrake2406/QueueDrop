"use client";

import { use } from "react";
import { StaffDashboard } from "@/features/staff/StaffDashboard";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";

interface Props {
  params: Promise<{
    businessSlug: string;
  }>;
}

export default function StaffPage({ params }: Props) {
  const { businessSlug } = use(params);

  return (
    <ProtectedRoute>
      <StaffDashboard businessSlug={businessSlug} />
    </ProtectedRoute>
  );
}
