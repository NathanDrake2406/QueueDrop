import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  title?: string;
}

export function QRCodeDisplay({ url, size = 200, title }: QRCodeDisplayProps) {
  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = size * 2;
      canvas.height = size * 2;
      ctx?.fillStyle && (ctx.fillStyle = "#ffffff");
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-code${title ? `-${title.toLowerCase().replace(/\s+/g, "-")}` : ""}.png`;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl">
        <QRCodeSVG
          id="qr-code-svg"
          value={url}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {title && <p className="text-sm text-zinc-400">{title}</p>}
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
