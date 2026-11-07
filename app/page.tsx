"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";
import {
  ShieldAlert,
  BarChart3,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-white font-sans flex flex-col">
      {/* Top Commercial Navigation Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-white text-black font-black text-sm flex items-center justify-center font-mono">
              M
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tight text-base uppercase leading-none">
                Mathlete Pro<span className="text-emerald-400">.</span>
              </span>
              <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
                Examination Architecture
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-mono uppercase tracking-wider text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#anti-cheat" className="hover:text-white transition-colors">
              Proctoring
            </a>
            <a href="#solutions" className="hover:text-white transition-colors">
              KaTeX Engine
            </a>
            <a href="#faculty" className="hover:text-white transition-colors">
              Faculty Studio
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 font-mono text-xs uppercase tracking-wider h-9 px-3"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button
                size="sm"
                className="rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider h-9 px-4"
              >
                Register
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 border-b border-zinc-800 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8 animate-in fade-in duration-700">
          
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-mono text-xs uppercase tracking-widest font-semibold rounded-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>High-Integrity Testing Engine // JEE & Olympiad Ready</span>
          </div>

          {/* Main Title */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter uppercase leading-none">
              Precision Assessment <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-300 to-zinc-500">
                For Advanced Mathematics
              </span>
            </h1>
            <p className="text-zinc-400 text-base md:text-xl max-w-3xl mx-auto font-normal leading-relaxed">
              The enterprise examination platform engineered for competitive coaching academies, 
              universities, and olympiad training centers. Sub-millisecond KaTeX equation rendering, 
              multi-strike proctoring, automated cohort analytics, and full Excel test authoring.
            </p>
          </div>

          {/* Interactive CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/student/tests" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-12 px-8 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                <span>ENTER STUDENT PORTAL</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/admin" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 px-8 rounded-none border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-900 font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span>FACULTY COMMAND CENTER</span>
              </Button>
            </Link>
          </div>

          {/* Trust Metric Strip */}
          <div className="pt-8 border-t border-zinc-900 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto font-mono text-left">
            <div className="p-4 border border-zinc-800 bg-zinc-950">
              <div className="text-2xl font-black text-white">&lt; 0.05s</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">KaTeX Render Speed</div>
            </div>
            <div className="p-4 border border-zinc-800 bg-zinc-950">
              <div className="text-2xl font-black text-emerald-400">3-Strike</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">Tab Monitoring Protocol</div>
            </div>
            <div className="p-4 border border-zinc-800 bg-zinc-950">
              <div className="text-2xl font-black text-white">Full Excel</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">Bulk Question Importer</div>
            </div>
            <div className="p-4 border border-zinc-800 bg-zinc-950">
              <div className="text-2xl font-black text-white">Real-Time</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">Cohort Percentiles</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Equation Demonstration */}
      <section id="solutions" className="py-16 border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                // MATHEMATICAL ENGINE
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                Flawless Mathematical Typesetting
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-500 uppercase hidden sm:inline">
              KaTeX 0.16.9 Native
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 border border-zinc-800 bg-black space-y-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                Calculus & Definite Integrals
              </span>
              <div className="text-lg text-zinc-200">
                <Latex>{"\\[ \\int_{0}^{\\frac{\\pi}{2}} \\frac{\\sin^3 x}{\\sin^3 x + \\cos^3 x} dx = \\frac{\\pi}{4} \\]"}</Latex>
              </div>
            </div>

            <div className="p-5 border border-zinc-800 bg-black space-y-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                Matrix Algebra & Adjoints
              </span>
              <div className="text-lg text-zinc-200">
                <Latex>{"\\[ \\det(2 \\cdot \\operatorname{adj}(A)) = 2^3 (\\det A)^{n-1} \\]"}</Latex>
              </div>
            </div>

            <div className="p-5 border border-zinc-800 bg-black space-y-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                Limits & Series Expansions
              </span>
              <div className="text-lg text-zinc-200">
                <Latex>{"\\[ \\lim_{x \\to 0} \\frac{e^{x^2} - 1 - x^2}{x^4} = \\frac{1}{2} \\]"}</Latex>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars Feature Grid */}
      <section id="features" className="py-20 border-b border-zinc-800 bg-black">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500">
              // ARCHITECTURAL CAPABILITIES
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight">
              Built for Institutional Scale
            </h2>
            <p className="text-zinc-400 text-sm">
              Every component is crafted for high-stakes testing integrity and immediate deployment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="p-6 border border-zinc-800 bg-zinc-950 space-y-4 rounded-none hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 border border-zinc-800 bg-black flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight font-mono">
                Multi-Strike Anti-Cheat
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Tab-switch monitoring and visibility state sensors trigger progressive warnings (Strike 1 to 3). 
                Persistent across browser refreshes with automated server-side submission locks upon final violation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 border border-zinc-800 bg-zinc-950 space-y-4 rounded-none hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 border border-zinc-800 bg-black flex items-center justify-center text-cyan-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight font-mono">
                Instant Scorecards & Percentiles
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Automated evaluation using custom marking schemes (+4/-1, +3/-1). 
                Interactive SVG Donut charts, topic-wise accuracy breakdowns, and item-by-item verified KaTeX derivations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 border border-zinc-800 bg-zinc-950 space-y-4 rounded-none hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 border border-zinc-800 bg-black flex items-center justify-center text-yellow-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight font-mono">
                Excel Bulk Question Studio
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Faculty can upload entire question banks via standard `.xlsx` spreadsheets with automated schema validation, 
                row error detection, KaTeX preview, and one-click cohort CSV exports.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 border border-zinc-800 bg-zinc-950 space-y-4 rounded-none hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 border border-zinc-800 bg-black flex items-center justify-center text-rose-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight font-mono">
                Enterprise Cloud Architecture
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Powered by PostgreSQL with Row-Level Security, atomic server-side scoring RPCs, 
                and zero answer leakage to ensure unmatched examination integrity and scale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial Call to Action Banner */}
      <section className="py-16 bg-zinc-950 border-b border-zinc-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Ready to Deploy for Your Institution?
          </h2>
          <p className="text-zinc-400 text-sm md:text-base font-medium">
            Launch the high-integrity examination portal, manage test series, author complex mathematical questions, and evaluate candidate performance with ease.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/student/tests">
              <Button className="h-12 px-8 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-widest">
                LAUNCH EXAM PORTAL
              </Button>
            </Link>
            <Link href="/admin">
              <Button
                variant="outline"
                className="h-12 px-8 rounded-none border-zinc-700 bg-black text-zinc-200 hover:bg-zinc-900 font-mono text-xs uppercase tracking-widest"
              >
                FACULTY CONSOLE
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-zinc-900 bg-black font-mono text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white text-black font-black text-[10px] flex items-center justify-center">
              M
            </div>
            <span>MATHLETE PRO &copy; {new Date().getFullYear()} // ALL RIGHTS RESERVED</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              SYSTEM OPERATIONAL
            </span>
            <span>•</span>
            <Link href="/auth/login" className="hover:text-white transition-colors">
              SIGN IN
            </Link>
            <span>•</span>
            <Link href="/student/tests" className="hover:text-white transition-colors">
              STUDENT PORTAL
            </Link>
            <span>•</span>
            <Link href="/admin" className="hover:text-white transition-colors">
              FACULTY STUDIO
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}