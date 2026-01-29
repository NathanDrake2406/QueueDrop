import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "@/index.css";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts: DM Sans (body) + Bricolage Grotesque (display) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
