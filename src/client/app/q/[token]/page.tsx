"use client";

import { use } from "react";
import { QueuePosition } from "@/features/customer/QueuePosition";

interface Props {
  params: Promise<{
    token: string;
  }>;
}

export default function QueuePositionPage({ params }: Props) {
  const { token } = use(params);

  return <QueuePosition token={token} />;
}
