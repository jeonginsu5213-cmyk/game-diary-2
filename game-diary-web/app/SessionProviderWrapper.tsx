"use client";

import { SessionProvider } from "next-auth/react";
import FcmTokenManager from "@/components/FcmTokenManager";

export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FcmTokenManager />
      {children}
    </SessionProvider>
  );
}
