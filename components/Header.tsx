"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { db } from "@/lib/instant-client";
import { ProfileDialog } from "./ProfileDialog";
import { SecureAccountDialog } from "./SecureAccountDialog";
import { LOGO } from "@/lib/branding";
import Image from "next/image";

interface HeaderProps {
    transparent?: boolean;
}

export function Header({ transparent }: HeaderProps) {
    const { user, isAuthenticated } = useAuth();
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [securityOpen, setSecurityOpen] = useState(false);

    const { data } = (db as any).useQuery(
        user ? { narratives: { $: { where: { "owner.id": user.id }, order: { createdAt: "desc" }, limit: 1 } } } : null
    );
    const latestNarrative = data?.narratives?.[0];

    return (
        <>
            <nav className={`fixed top-0 z-50 w-full border-b border-white/10 transition-colors ${transparent ? 'bg-[var(--nav-bg)]/60 backdrop-blur-md' : 'bg-[var(--nav-bg)]'}`}>
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-3 active:scale-95 transition-transform shrink-0">
                        <Image 
                            width={160} 
                            height={40} 
                            src={LOGO.full} 
                            alt={LOGO.alt} 
                            className="h-auto w-40 sm:w-44"
                            priority
                        />
                        <div className="flex items-center gap-2">
                            {user && 'planId' in user && user.planId === 'pro' && (
                                <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-red-600 to-red-700 text-[9px] font-black text-white uppercase tracking-wider shadow-lg shadow-red-500/20">
                                    Pro
                                </span>
                            )}
                            {user && 'planId' in user && user.planId === 'pro_max' && (
                                <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-red-600 to-orange-600 text-[9px] font-black text-white uppercase tracking-wider shadow-lg shadow-red-500/20">
                                    Pro Max
                                </span>
                            )}
                        </div>
                    </Link>
                    
                    <div className="flex items-center gap-3 sm:gap-6">
                        {isAuthenticated ? (
                            <>
                                <Link
                                    href="/dashboard"
                                    className="text-[11px] font-black uppercase tracking-widest text-[#929bc9] transition hover:text-white flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-base">dashboard</span>
                                    Dashboard
                                </Link>

                                <div className="relative">
                                    <button 
                                        onClick={() => setCreateMenuOpen(!createMenuOpen)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${createMenuOpen ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-[#929bc9] hover:text-white border border-white/5'}`}
                                    >
                                        <span className="material-symbols-outlined text-base">add</span>
                                        Create
                                        <span className={`material-symbols-outlined text-xs transition-transform ${createMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>

                                    {createMenuOpen && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-10" 
                                                onClick={() => setCreateMenuOpen(false)}
                                            />
                                            <div className="absolute right-0 mt-2 w-56 bg-[#101322]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                                <Link 
                                                    href="/narrative/new" 
                                                    onClick={() => setCreateMenuOpen(false)}
                                                    className="flex items-center gap-2.5 p-3 hover:bg-white/5 rounded-lg transition-colors group"
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all scale-90">
                                                        <span className="material-symbols-outlined text-base">edit_note</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Founder Narrative</span>
                                                        <span className="text-[9px] font-bold text-slate-500">Define your core story</span>
                                                    </div>
                                                </Link>
                                                <div className="h-px bg-white/5 my-1.5" />
                                                {latestNarrative ? (
                                                    <Link 
                                                        href={`/narrative/${latestNarrative.id}/drafts`}
                                                        onClick={() => setCreateMenuOpen(false)}
                                                        className="w-full text-left flex items-center gap-2.5 p-3 hover:bg-white/5 rounded-lg transition-colors group cursor-pointer focus:outline-none"
                                                    >
                                                        <div className="h-8 w-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all scale-90">
                                                            <span className="material-symbols-outlined text-base">movie</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Generate Video</span>
                                                            <span className="text-[9px] font-bold text-slate-500">From Approved Drafts</span>
                                                        </div>
                                                    </Link>
                                                ) : (
                                                    <Link 
                                                        href="/narrative/new" 
                                                        onClick={() => setCreateMenuOpen(false)}
                                                        className="flex items-center gap-2.5 p-3 hover:bg-white/5 rounded-lg transition-colors group"
                                                    >
                                                        <div className="h-8 w-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all scale-90">
                                                            <span className="material-symbols-outlined text-base">movie</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Generate Video</span>
                                                            <span className="text-[9px] font-bold text-slate-500">From Approved Drafts</span>
                                                        </div>
                                                    </Link>
                                                )}
                                                <Link 
                                                    href="/create-series" 
                                                    onClick={() => setCreateMenuOpen(false)}
                                                    className="flex items-center gap-2.5 p-3 hover:bg-white/5 rounded-lg transition-colors group"
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all scale-90">
                                                        <span className="material-symbols-outlined text-base">auto_stories</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Serial Series</span>
                                                        <span className="text-[9px] font-bold text-slate-500">Multi-episode narrative</span>
                                                    </div>
                                                </Link>
                                                <Link 
                                                    href="/demo-narrator" 
                                                    onClick={() => setCreateMenuOpen(false)}
                                                    className="flex items-center gap-2.5 p-3 hover:bg-white/5 rounded-lg transition-colors group"
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all scale-90">
                                                        <span className="material-symbols-outlined text-base">mic</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Demo Narrator</span>
                                                        <span className="text-[9px] font-bold text-slate-500">Video voiceover package</span>
                                                    </div>
                                                </Link>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button 
                                    onClick={() => setProfileOpen(true)}
                                    className="flex items-center gap-2 group"
                                >
                                    <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white group-hover:border-red-500/50 transition-colors">
                                        {user && 'email' in user && user.email ? user.email.charAt(0).toUpperCase() : "G"}
                                    </div>
                                    <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-widest text-[#929bc9] group-hover:text-white transition-colors">Profile</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* <Link
                                    href="/#pricing"
                                    className="text-xs font-bold text-[#929bc9] transition hover:text-white"
                                >
                                    Pricing
                                </Link> */}
                                <Link
                                    href="/narrative/new"
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20"
                                >
                                    Start Narrative
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            <ProfileDialog 
                isOpen={profileOpen} 
                onClose={() => setProfileOpen(false)} 
                onOpenSecurity={() => setSecurityOpen(true)}
            />
            
            <SecureAccountDialog 
                isOpen={securityOpen}
                onClose={() => setSecurityOpen(false)}
            />
        </>
    );
}
