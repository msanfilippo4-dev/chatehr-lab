import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatEHR Lab — HINF 6117",
  description: "Fordham University — AI in Healthcare Lab: Build a Gemini-powered EHR Chatbot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#f4f7fb] text-[#122033] antialiased">
        {/* Fordham Maroon Header */}
        <header className="bg-gradient-to-r from-[#7A1313] via-[#8C1515] to-[#6B1010] border-b border-[#5A0E0E] shadow-xl">
          <div className="max-w-screen-2xl mx-auto px-4 py-2 md:h-14 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center font-bold text-white text-sm border border-white/25 shadow-inner">
                F
              </div>
              <div className="leading-tight">
                <span className="block text-white font-bold text-sm tracking-wide">
                  FORDHAM UNIVERSITY
                </span>
                <span className="hidden lg:block text-red-200 text-xs">
                  HINF 6117 — Artificial Intelligence in Healthcare
                </span>
              </div>
            </div>
            <div className="text-red-200 text-xs md:text-xs font-mono ml-auto tracking-wide">
              ChatEHR Lab · Spring 2026
            </div>
          </div>
        </header>
        <main className="max-w-screen-2xl mx-auto px-4 py-5 md:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
