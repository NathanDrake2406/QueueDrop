import type { Metadata } from "next";
import { JoinQueueClient } from "./JoinQueueClient";
import type { QueuesResponse } from "@/features/customer/JoinQueue";

interface Props {
  params: Promise<{
    businessSlug: string;
    queueSlug?: string[];
  }>;
}

// Server-side data fetching for performance
async function getQueueData(businessSlug: string): Promise<QueuesResponse | null> {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";

  try {
    const res = await fetch(`${backendUrl}/api/business/${businessSlug}/queues`, {
      cache: "no-store", // Always fetch fresh data
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    // If server fetch fails, client will retry
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessSlug } = await params;

  // Try to fetch actual business name for metadata
  const data = await getQueueData(businessSlug);
  const businessName = data?.businessName || businessSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    title: `Join Queue - ${businessName}`,
    description: `Join the queue at ${businessName}. Get your spot and we'll notify you when it's your turn.`,
    openGraph: {
      title: `Join Queue - ${businessName}`,
      description: `Join the queue at ${businessName}. No app required - works in any browser.`,
      type: "website",
    },
  };
}

export default async function JoinPage({ params }: Props) {
  const { businessSlug, queueSlug } = await params;

  // Fetch queue data server-side for faster initial render
  const serverData = await getQueueData(businessSlug);

  return (
    <JoinQueueClient
      businessSlug={businessSlug}
      queueSlug={queueSlug?.[0]}
      serverData={serverData ?? undefined}
    />
  );
}
