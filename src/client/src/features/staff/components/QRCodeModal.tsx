import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeModalProps {
  businessSlug: string;
  queueSlug: string;
  queueName: string;
  onClose: () => void;
}

export function QRCodeModal({ businessSlug, queueSlug, queueName, onClose }: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Use current origin or fallback for dev
  const baseUrl = window.location.origin;
  const joinUrl = `${baseUrl}/join/${businessSlug}/${queueSlug}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    // Create canvas from SVG
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      // High-res for printing
      canvas.width = 1024;
      canvas.height = 1024;
      
      // White background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code centered with padding
      const padding = 128;
      ctx.drawImage(img, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
      
      // Add text below
      ctx.fillStyle = "#18181b";
      ctx.font = "bold 48px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(queueName, canvas.width / 2, canvas.height - 48);
      
      // Download
      const link = document.createElement("a");
      link.download = `${businessSlug}-qr-code.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(joinUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Share Your Queue</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div ref={qrRef} className="bg-white rounded-2xl p-6 mb-6">
          <QRCodeSVG
            value={joinUrl}
            size={256}
            level="H"
            includeMargin={false}
            className="w-full h-auto"
          />
          <p className="text-center text-slate-600 text-sm mt-4 font-medium">{queueName}</p>
        </div>

        {/* URL Display */}
        <div className="bg-slate-800 rounded-xl p-3 mb-6">
          <p className="text-xs text-slate-500 mb-1">Join link</p>
          <p className="text-sm text-slate-300 font-mono truncate">{joinUrl}</p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className="py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Link
          </button>
          <button
            onClick={handleDownload}
            className="py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-slate-500 text-center mt-6">
          Print this QR code and display it at your entrance. Customers scan to join the queue.
        </p>
      </div>
    </div>
  );
}
