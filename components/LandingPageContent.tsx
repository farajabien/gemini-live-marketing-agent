"use client";

import { LANDING_CONTENT } from "@/lib/landing-content";
import { Header } from "@/components/Header";
import Link from "next/link";
import Image from "next/image";

export function LandingPageContent() {
  const { hero, problem, solution, howItWorks, whoItIsFor, gettingStarted, finalCta } = LANDING_CONTENT;

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-red-500/30 text-slate-100">
      <main>
        <Header transparent />

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-red-600/10 rounded-full blur-[120px] -z-10 opacity-30"></div>
          
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-8 inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-500 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {hero.badge}
              </div>
              <div className="max-w-4xl space-y-6">
                <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
                  {hero.title}
                </h1>
                <p className="mx-auto max-w-xl text-lg text-[#9cb3ff] leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500 fill-mode-both">
                  {hero.subtitle}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-medium mt-4 animate-in fade-in duration-1000 delay-700 fill-mode-both">
                  <span>Powered by</span>
                  <div className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                    <Image src="/logos/gemini.png" alt="Google Gemini" width={120} height={30} className="h-5 w-auto" />
                  </div>
                </div>
                <div className="flex flex-col w-full sm:flex-row gap-4 justify-center pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-1000 fill-mode-both">
                  <Link
                    href="/narrative/new"
                    className="inline-flex h-14 items-center justify-center rounded-xl bg-red-600 px-10 text-lg font-bold text-white shadow-xl shadow-red-500/25 transition-all hover:scale-105 active:scale-95 hover:bg-red-500"
                  >
                    {hero.cta}
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex h-14 items-center justify-center rounded-xl bg-white/5 border border-white/10 px-10 text-lg font-bold text-white transition-all hover:bg-white/10 hover:border-white/20"
                  >
                    See the System
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-32 border-y border-white/5 bg-black relative overflow-hidden">
          <div className="absolute top-0 right-0 size-[400px] bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="mx-auto max-w-5xl px-4 text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-16 leading-tight max-w-3xl mx-auto">
                {problem.title}
            </h2>
            <div className="grid gap-8 text-left sm:grid-cols-2">
                {problem.points.map((point, i) => (
                  <div key={i} className="p-10 rounded-[2.5rem] bg-[#050510] border border-white/5 hover:border-red-500/20 transition-all duration-500 group">
                    <div className="size-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
                      {point.emoji}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{point.title}</h3>
                    <p className="text-[#929bc9] text-base leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                      {point.text}
                    </p>
                  </div>
                ))}
            </div>
            <div className="mt-20">
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-red-500/10 to-transparent rounded-2xl border border-red-500/20">
                    <span className="material-symbols-outlined text-red-400 rotate-12">warning</span>
                    <p className="text-lg font-bold text-red-400">
                        {problem.summary}
                    </p>
                </div>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-24 bg-black">
          <div className="mx-auto max-w-5xl px-4 flex flex-col items-center gap-16 text-center lg:flex-row lg:text-left">
             <div className="flex-1 space-y-8">
                <h2 className="text-4xl font-black text-white leading-tight">{solution.title}</h2>
                <div className="space-y-6">
                    {solution.steps.map((step) => (
                      <div key={step.number} className="flex gap-4">
                        <div className="flex-shrink-0 size-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 font-black">{step.number}</div>
                        <p className="text-[#929bc9] text-left leading-relaxed">
                          <span className="text-white font-bold">{step.title}</span> {step.text}
                        </p>
                      </div>
                    ))}
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-r from-red-600/10 to-transparent border-l-4 border-red-600">
                    <p className="text-xl text-white font-black italic tracking-wide">&quot;{solution.formula}&quot;</p>
                </div>
             </div>
             <div className="flex-1 w-full max-w-md bg-[#101322] rounded-[2.5rem] border border-white/5 p-4 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] overflow-hidden scale-105">
                <div className="aspect-[9/16] bg-slate-900 rounded-[1.8rem] relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-red-600/20 to-transparent pointer-events-none"></div>
                  <span className="material-symbols-outlined text-red-500/20 text-8xl">play_circle</span>
                  <div className="absolute bottom-8 left-8 right-8 space-y-3">
                    <div className="h-4 w-2/3 bg-white/20 rounded-full animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-white/10 rounded-full animate-pulse"></div>
                  </div>
                </div>
             </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="py-24 bg-black border-t border-white/5">
            <div className="mx-auto max-w-7xl px-4 text-center">
                <h2 className="text-3xl font-black text-white mb-8">{whoItIsFor.title}</h2>
                <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto mb-10">
                    {whoItIsFor.tags.map(tag => (
                        <div key={tag} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:border-red-500/50 transition-colors">
                            {tag}
                        </div>
                    ))}
                </div>
                <p className="text-[#929bc9] text-lg max-w-2xl mx-auto leading-relaxed">
                    {whoItIsFor.description}
                </p>
            </div>
        </section>

        {/* Getting Started Flow */}
        <section className="py-32 bg-black border-t border-white/5 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="mx-auto max-w-7xl px-4 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">{gettingStarted.title}</h2>
                    <p className="text-[#929bc9] text-lg max-w-2xl mx-auto">{gettingStarted.subtitle}</p>
                </div>

                <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
                    {gettingStarted.steps.map((step, i) => (
                        <div key={i} className="relative group">
                            {i < gettingStarted.steps.length - 1 && (
                                <div className="hidden md:block absolute top-16 left-[calc(100%+1rem)] w-8 text-red-500/20 text-4xl pointer-events-none">
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </div>
                            )}

                            <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 hover:border-red-500/30 transition-all duration-500 h-full flex flex-col">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="size-16 rounded-2xl bg-red-600/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
                                        <span className="material-symbols-outlined text-3xl text-red-500">{step.icon}</span>
                                    </div>
                                    <div className="text-6xl font-black text-white/5 leading-none">{step.number}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
                                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{step.badge}</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3">{step.title}</h3>
                                </div>

                                <p className="text-[#929bc9] leading-relaxed flex-1">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Link
                        href="/narrative/new"
                        className="inline-flex h-14 items-center justify-center rounded-xl bg-red-600 px-10 text-lg font-bold text-white shadow-xl shadow-red-500/25 transition-all hover:scale-105 active:scale-95 hover:bg-red-500"
                    >
                        Start Your First Narrative
                    </Link>
                    <p className="mt-4 text-sm text-white/40">No credit card required &bull; 1 free video included</p>
                </div>
            </div>
        </section>

        {/* How it Works */}
        <section className="py-32 bg-black border-t border-white/5" id="how-it-works">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="mb-20 text-center text-4xl font-black text-white tracking-tight">{howItWorks.title}</h2>
            <div className="grid gap-16 md:grid-cols-3 text-center">
              {howItWorks.steps.map((s, i) => (
                <div key={i} className="space-y-6 group">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 text-red-500 transform transition-transform group-hover:scale-110 group-hover:rotate-6">
                    <span className="material-symbols-outlined text-4xl">{s.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{s.title}</h3>
                  <p className="text-[#929bc9] leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rendering Disclaimer */}
        <div className="py-8 bg-amber-500/5 border-y border-amber-500/20">
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="material-symbols-outlined text-amber-400 text-2xl flex-shrink-0 mt-0.5">schedule</span>
              <div className="space-y-2">
                <p className="text-white font-bold text-lg">Rendering Time Notice</p>
                <p className="text-amber-100/90 text-sm leading-relaxed">
                  Video rendering takes approximately <strong>3-5 minutes</strong> for a 2-minute video. 
                  Generation happens in the background &mdash; you can leave and come back when it&apos;s ready!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <section className="py-32 bg-[#050510] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none"></div>
          <div className="mx-auto max-w-3xl px-4 text-center relative z-10">
            <h2 className="text-4xl font-black text-white mb-8 leading-tight tracking-tight">
                {finalCta.title}
            </h2>
            <Link
              href="/narrative/new"
              className="inline-flex h-16 items-center justify-center rounded-2xl bg-red-600 px-12 text-xl font-black text-white shadow-2xl shadow-red-500/30 transition hover:scale-105 active:scale-95"
            >
              {finalCta.buttonText}
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-16 border-t border-white/5 bg-black">
        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
               <Image src="/logos/ideatovideo-full-logo.png" alt="Logo" width={100} height={100} className="h-auto w-full"/>
            </Link>
          <p className="text-sm text-[#929bc9] font-medium">
            &copy; {new Date().getFullYear()} Alien Intelligence. Built for creators.
          </p>
        </div>
      </footer>
    </div>
  );
}
