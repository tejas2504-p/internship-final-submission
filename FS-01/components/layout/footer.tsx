import * as React from "react";
import Link from "next/link";
import { Layers, ExternalLink, Mail, Globe } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-14">
          {/* Column 1 – SyncSpace */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 p-0.5 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
                <div className="w-full h-full bg-white rounded-[6px] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-sky-500" />
                </div>
              </div>
              <span className="font-black text-lg text-slate-900 tracking-tight">SyncSpace</span>
            </Link>
            <p className="text-xs text-slate-600 leading-relaxed">
              SyncSpace unifies structured document editing with an infinite collaborative canvas and vector sketchboard for high-velocity teams.
            </p>
            <p className="text-xs font-medium text-slate-500 italic">
              One Workspace. Infinite Possibilities.
            </p>
          </div>

          {/* Column 2 – Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <Link href="/#features" className="hover:text-slate-900 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-slate-900 transition-colors">
                  Live Demo
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-slate-900 transition-colors">
                  Workspaces
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-slate-900 transition-colors">
                  Infinite Canvas
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-slate-900 transition-colors">
                  Sketchboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 – Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <Link href="/#features" className="hover:text-slate-900 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/tejas2504-p/syncspace-collaborative-workspace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  <GithubIcon className="w-3.5 h-3.5 text-slate-700" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <Link href="/register" className="hover:text-slate-900 transition-colors">
                  Getting Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 – Connect */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Connect
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <a
                  href="https://github.com/tejas2504-p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  <GithubIcon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Developer Profile</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/tejas2504-p/syncspace-collaborative-workspace/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-700" />
                  <span>Contact &amp; Support</span>
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-700" />
                  <span>Professional Network</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; 2026 SyncSpace. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
