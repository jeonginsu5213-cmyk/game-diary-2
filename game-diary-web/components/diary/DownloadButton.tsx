"use client";

import React from 'react';

export const handleDownload = async (url: string) => {
  try {
    // Check if it's a Supabase Storage URL
    if (url.includes('/storage/v1/object/public/')) {
      const downloadUrl = new URL(url);
      downloadUrl.searchParams.set('download', '');
      const link = document.createElement('a');
      link.href = downloadUrl.toString();
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const response = await fetch(url).catch(() => null);
    if (response && response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `game-diary-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } else {
      window.open(url, '_blank');
    }
  } catch (error) {
    window.open(url, '_blank');
  }
};

const DownloadButton = ({ url, className = "" }: { url: string; className?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); handleDownload(url); }}
    className={`p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg transition-all cursor-pointer group/dl ${className}`}
  >
    <svg className="w-4 h-4 text-white group-hover/dl:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  </button>
);

export default DownloadButton;
