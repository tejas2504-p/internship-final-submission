import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "SyncSpace — Real-Time Collaborative Workspace (Notion × Figma)",
  description:
    "A next-generation collaborative workspace uniting structured block documentation with a freeform infinite canvas. Built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, and Prisma.",
  keywords: [
    "collaboration",
    "real-time workspace",
    "Notion alternative",
    "Figma whiteboard",
    "infinite canvas",
    "Next.js",
    "Prisma",
    "TypeScript",
  ],
  authors: [{ name: "SyncSpace Team" }],
  openGraph: {
    title: "SyncSpace — Real-Time Collaborative Workspace",
    description:
      "Where docs meet infinite canvas in real-time. Notion fluidity meets Figma spatial freedom.",
    url: "https://syncspace.app",
    siteName: "SyncSpace",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-slate-900 transition-colors duration-200"
      >
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
