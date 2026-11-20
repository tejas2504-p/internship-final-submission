"use client";

import * as React from "react";
import Link from "next/link";
import { Layers, Menu, X, ArrowRight } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavbarProps {
  onGetStarted?: () => void;
}

export function Navbar({ onGetStarted }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glassmorphism-nav border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 p-0.5 shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-sky-500 group-hover:text-sky-600 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-slate-950 transition-colors">
                  SyncSpace
                </span>
                <span className="text-[10px] text-slate-500 -mt-0.5 hidden sm:inline font-mono uppercase tracking-wider">
                  Docs × Canvas
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link
              href="/#features"
              className="hover:text-slate-950 transition-colors py-1 flex items-center gap-1.5"
            >
              <span>Features</span>
            </Link>
            <Link
              href="/demo"
              className="hover:text-slate-950 transition-colors py-1 flex items-center gap-1.5"
            >
              <span>Live Demo</span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </Link>
            <Link
              href="/#workflow"
              className="hover:text-slate-950 transition-colors py-1"
            >
              Workflow
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/tejas2504-p/syncspace-collaborative-workspace"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus-ring"
              title="GitHub Repository"
            >
              <GithubIcon className="w-4 h-4" />
            </a>

            <Button asChild variant="ghost" size="sm" className="text-slate-700 hover:text-slate-950 hover:bg-slate-100">
              <Link href="/login">
                Sign in
              </Link>
            </Button>

            <Button asChild variant="glow" size="sm">
              <Link href="/register">
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none focus-ring"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-2xl border-t border-slate-200/80 px-4 pt-3 pb-6 space-y-4 shadow-xl">
          <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900"
            >
              Features
            </Link>
            <Link
              href="/demo"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 flex items-center justify-between"
            >
              <span>Live Demo</span>
              <Badge variant="success" size="sm">Live</Badge>
            </Link>
            <Link
              href="/#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900"
            >
              Workflow
            </Link>
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2.5">
            <Button asChild variant="secondary" size="md" className="w-full">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
            </Button>
            <Button asChild variant="glow" size="md" className="w-full">
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
