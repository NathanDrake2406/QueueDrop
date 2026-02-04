"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

export function QRScanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    if (!containerRef.current) return;

    setError(null);
    setIsScanning(true);

    try {
      // Dynamic import - only loads when camera starts
      const { Html5Qrcode } = await import("html5-qrcode");
      scannerRef.current = new Html5Qrcode("qr-reader");

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Handle successful scan
          handleScan(decodedText);
        },
        () => {
          // Ignore scan failures (continuous scanning)
        }
      );
    } catch (err) {
      setIsScanning(false);
      if (err instanceof Error) {
        if (err.message.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access.");
        } else {
          setError("Could not start camera. Try entering the code manually.");
        }
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setIsScanning(false);
  };

  const handleScan = async (url: string) => {
    await stopScanning();

    try {
      // Parse the URL to extract the path
      const parsed = new URL(url);
      const path = parsed.pathname;

      // Check if it's a valid QueueDrop URL
      if (path.startsWith("/join/")) {
        router.push(path);
      } else if (path.startsWith("/q/")) {
        router.push(path);
      } else {
        setError("Invalid QR code. Please scan a QueueDrop queue code.");
      }
    } catch {
      // Not a valid URL, try treating it as a business slug
      if (/^[a-z0-9-]+$/i.test(url)) {
        router.push(`/join/${url}`);
      } else {
        setError("Invalid QR code format.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Scan QR Code</h1>
          <div className="w-10" />
        </div>

        {/* Scanner area */}
        <div className="relative aspect-square bg-slate-900 rounded-none overflow-hidden mb-6">
          <div id="qr-reader" ref={containerRef} className="w-full h-full" />
          
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 mb-6 text-slate-600">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z"/>
                </svg>
              </div>
              <p className="text-slate-400 text-center mb-6">
                Point your camera at a QueueDrop QR code to join instantly
              </p>
              <button
                onClick={startScanning}
                className="px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
              >
                Start Camera
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-none mb-6">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Stop button */}
        {isScanning && (
          <button
            onClick={stopScanning}
            className="w-full py-4 bg-slate-800 text-white font-semibold rounded-none hover:bg-slate-700 transition-colors"
          >
            Stop Scanning
          </button>
        )}

        {/* Manual entry option */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Or enter the queue code manually on the{" "}
            <button
              onClick={() => router.push("/")}
              className="text-white underline hover:no-underline"
            >
              home page
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
