import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin requests from local network during development
  allowedDevOrigins: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],

  // Proxy API and SignalR requests to the backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
      {
        source: "/hubs/:path*",
        destination: "http://localhost:5000/hubs/:path*",
      },
    ];
  },
};

export default nextConfig;
