import type { Metadata, Viewport } from "next";
import { DM_Sans, Bricolage_Grotesque } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "@/index.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "QueueDrop - Smart Queue Management",
  description:
    "Eliminate wait time frustration. QueueDrop lets customers join queues remotely and get notified when it's their turn.",
  keywords: "queue management, waitlist, restaurant queue, appointment booking",
  openGraph: {
    type: "website",
    title: "QueueDrop - Smart Queue Management",
    description:
      "Eliminate wait time frustration. Let customers join queues remotely and get notified when it's their turn.",
    images: ["/screenshots/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QueueDrop",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d9488",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${bricolage.variable}`}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
