"use client";

import { JoinQueue } from "@/features/customer/JoinQueue";

interface Props {
  businessSlug: string;
  queueSlug?: string;
}

export function JoinQueueClient({ businessSlug, queueSlug }: Props) {
  return <JoinQueue businessSlug={businessSlug} queueSlug={queueSlug} />;
}
