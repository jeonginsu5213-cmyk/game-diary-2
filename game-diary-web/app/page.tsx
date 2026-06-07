"use client";

import React, { useEffect, Suspense } from 'react';
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from 'next/navigation';
import InteractiveHero from '@/components/main/hero';

function LandingPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceLanding = searchParams.get('landing') === 'true';

  useEffect(() => {
    if (status === "authenticated" && !forceLanding) {
      router.replace('/diary');
    }
  }, [status, router, forceLanding]);

  if (status === "loading" || (status === "authenticated" && !forceLanding)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="w-full">
      <InteractiveHero />
    </main>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  );
}
