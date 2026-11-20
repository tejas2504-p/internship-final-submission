"use client";

import * as React from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/landing/hero";
import { CollaborationStudio } from "@/components/landing/interactive-preview";
import { Features } from "@/components/landing/features";
import { WorkflowComparison } from "@/components/landing/workflow-comparison";
import { CtaSection } from "@/components/landing/cta-section";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/register");
  };

  const handleExploreDemo = () => {
    router.push("/demo");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 relative selection:bg-sky-500/20 selection:text-sky-900">
      {/* Background Subtle Dot Pattern Canvas Texture */}
      <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none -z-10" />

      {/* Navigation */}
      <Navbar onGetStarted={handleGetStarted} />

      {/* Main Landing Page Content */}
      <main className="flex-1">
        <Hero
          onGetStarted={handleGetStarted}
          onExploreFeatures={handleExploreDemo}
        />
        <CollaborationStudio />
        <Features />
        <WorkflowComparison />
        <CtaSection onGetStarted={handleGetStarted} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
