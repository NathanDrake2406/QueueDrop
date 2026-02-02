"use client";

import { JoinQueue, type QueuesResponse } from "@/features/customer/JoinQueue";

interface Props {
  businessSlug: string;
  queueSlug?: string;
  serverData?: QueuesResponse;
}

export function JoinQueueClient({ businessSlug, queueSlug, serverData }: Props) {
  return (
    <JoinQueue
      businessSlug={businessSlug}
      queueSlug={queueSlug}
      serverData={serverData}
    />
  );
}
