import type { Metadata } from "next";
import { JoinQueueClient } from "./JoinQueueClient";

interface Props {
  params: Promise<{
    businessSlug: string;
    queueSlug?: string[];
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessSlug } = await params;

  // In a real app, you'd fetch the business name here
  // For now, we'll create a nice fallback from the slug
  const businessName = businessSlug
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

  return (
    <JoinQueueClient
      businessSlug={businessSlug}
      queueSlug={queueSlug?.[0]}
    />
  );
}
