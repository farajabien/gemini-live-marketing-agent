"use client";

import { LANDING_CONTENT } from "@/lib/landing-content";
import { PRICING_TIERS, UPGRADE_FAQ } from "@/lib/pricing";
import { Header } from "@/components/Header";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import Image from "next/image";
import dynamic from "next/dynamic";


export default function LandingPage() {
  const { hero, problem, solution, howItWorks, whoItIsFor, useCases, finalCta } = LANDING_CONTENT;
  const tiers = Object.values(PRICING_TIERS);
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-red-500/30 text-slate-100">
      <main>
        <Header transparent />

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
          {/* Background element */}
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

      
        {/* Problem Section - Styled as high-impact stack */}
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
                    <p className="text-xl text-white font-black italic tracking-wide">"{solution.formula}"</p>
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

        {/* Who It's For - Targeted Section */}
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

       
        {/* Final Polish: Removing old Use Cases as Carousel covers it */}

        {/* Rendering Disclaimer */}
        <div className="py-8 bg-amber-500/5 border-y border-amber-500/20">
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="material-symbols-outlined text-amber-400 text-2xl flex-shrink-0 mt-0.5">schedule</span>
              <div className="space-y-2">
                <p className="text-white font-bold text-lg">⏱️ Rendering Time Notice</p>
                <p className="text-amber-100/90 text-sm leading-relaxed">
                  Current video rendering takes approximately <strong>8-10 minutes</strong> for a 2-minute video. 
                  We're actively working on optimizations to significantly reduce this time. 
                  Meanwhile, generation happens in the background—you can leave and come back when it's ready!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <section className="py-32 bg-black" id="pricing">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-20 text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white text-center">
                Start for free, upgrade <br className="hidden md:block"/> when you go viral.
              </h2>
              <p className="text-[#929bc9] text-lg max-w-2xl mx-auto font-medium">Clear, transparent pricing for creators of all sizes.</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto mb-20">
              {tiers.map((tier) => {
                const isPro = tier.id === "pro";
                const isProMax = tier.id === "pro_max";
                return (
                      <div 
                        key={tier.id} 
                        className={`p-10 rounded-[2.5rem] border flex flex-col gap-8 relative transition-all duration-500 hover:translate-y-[-8px] ${
                          isPro
                            ? "border-red-600 bg-white/5 shadow-[0_32px_64px_-12px_rgba(220,38,38,0.25)] scale-[1.02]" 
                            : isProMax
                            ? "border-orange-500 bg-white/5 shadow-[0_32px_64px_-12px_rgba(249,115,22,0.25)]" 
                            : "border-white/5 bg-black"
                        }`}
                      >
                    {isPro && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 px-5 py-2 rounded-full text-[10px] font-black uppercase text-white tracking-widest leading-none flex h-7 items-center shadow-lg">Most Popular</div>
                    )}
                    {isProMax && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-orange-600 px-5 py-2 rounded-full text-[10px] font-black uppercase text-white tracking-widest leading-none flex h-7 items-center shadow-lg">Cinematic</div>
                    )}
                    <div>
                      <h3 className={`text-2xl font-black ${isPro ? "text-red-400" : isProMax ? "text-orange-400" : "text-white"}`}>{tier.name}</h3>
                      <p className="text-[#929bc9] text-base mt-2 mb-6 font-medium">{tier.description}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white">${tier.price}</span>
                        {tier.price > 0 && <span className="text-[#929bc9] font-bold">/month</span>}
                        {tier.price === 0 && <span className="text-[#929bc9] font-bold italic"> forever</span>}
                      </div>
                    </div>
                    <ul className="space-y-4 flex-1">
                      {tier.features.map((f: string) => (
                        <li key={f} className="flex gap-3 text-base text-slate-300 font-medium items-center">
                          <span className={`material-symbols-outlined text-xl font-bold ${isPro ? "text-red-500" : isProMax ? "text-orange-500" : "text-slate-500"}`}>check</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={isAuthenticated ? (tier.id !== "free" ? "/upgrade" : "/dashboard?tool=generate") : "/dashboard?tool=generate"}
                      className={`w-full py-4 rounded-2xl font-black text-center transition-all active:scale-95 ${
                        isPro
                          ? "bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-900/40" 
                          : isProMax
                          ? "bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 shadow-xl shadow-orange-900/40"
                          : "bg-white text-black hover:bg-slate-200"
                      }`}
                    >
                      {tier.buttonText}
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Comparison Note */}
            <div className="max-w-4xl mx-auto p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md mb-20">
              <h4 className="text-xl font-black text-white mb-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500 text-2xl">theaters</span>
                What&apos;s the difference between Pro and Pro Max?
              </h4>
              <div className="grid md:grid-cols-2 gap-6 text-slate-300">
                <div className="space-y-2">
                  <p className="font-bold text-red-400">Pro — Static Images</p>
                  <p className="text-sm leading-relaxed">High-quality AI-generated images (2K resolution) for each scene. Perfect for polished educational content and carousels.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-orange-400">Pro Max — AI B-Roll Clips</p>
                  <p className="text-sm leading-relaxed">Cinematic video clips (4-8 seconds each) generated by Google Veo 3.1. Adds professional motion and visual storytelling to every scene.</p>
                </div>
              </div>
            </div>

            {/* UPGRADE FAQs */}
            <div className="mt-32 max-w-3xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h3 className="text-3xl font-black text-white">Common Questions</h3>
                    <p className="text-[#929bc9]">Everything you need to know about the Pro upgrade.</p>
                </div>
                <div className="grid gap-6">
                    {UPGRADE_FAQ.map((item, i) => (
                        <div key={i} className="p-8 rounded-[2rem] bg-[#050510] border border-white/5 hover:border-white/10 transition-colors group">
                            <p className="text-white font-black text-lg mb-3 flex items-center gap-3">
                                <span className="h-6 w-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-xs">Q</span>
                                {item.q}
                            </p>
                            <p className="text-[#929bc9] text-base leading-relaxed pl-9">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </section>

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
            © {new Date().getFullYear()} Alien Intelligence. Built for creators.
          </p>
        </div>
      </footer>
    </div>
  );
}
