"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import Image from "next/image";

export function AuthScreen() {
    const { signInAsGuest } = useAuth();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"email" | "code">("email");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await db.auth.sendMagicCode({ email });
            setStep("code");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await db.auth.signInWithMagicCode({ email, code });
            window.location.reload();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Invalid code. Please try again.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0d] flex flex-col relative overflow-hidden">
            <Header />
            
            {/* Background Effects */}
            <div className="absolute top-0 -left-20 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-40 -right-20 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="text-center mb-8">
                       <Image src="/logos/ideatovideo-icon.png" alt="Logo" width={100} height={100} className="mx-auto w-8 h-auto"/>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-3">Claim your voice</h1>
                        <p className="text-slate-400">Sign in to start your founder narrative and generate your first batch of content.</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                        {step === "email" ? (
                            <form onSubmit={handleSendCode} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                                    <input 
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
                                    />
                                </div>
                                
                                {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}

                                <button 
                                    type="submit"
                                    disabled={isLoading || !email}
                                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                                >
                                    {isLoading ? "Sending Link..." : "Send Magic Link"}
                                </button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                                    <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-[#12121a] px-4 text-slate-500">Or continue with</span></div>
                                </div>

                                <button 
                                    type="button"
                                    onClick={signInAsGuest}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95 text-sm"
                                >
                                    Guest Account
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyCode} className="space-y-6">
                                <div className="text-center space-y-2 mb-4">
                                    <p className="text-sm text-slate-400">We sent a verification code to</p>
                                    <p className="text-sm text-blue-400 font-bold">{email}</p>
                                </div>
                                
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest text-center block">Enter 6-Digit Code</label>
                                    <input 
                                        type="text"
                                        required
                                        maxLength={6}
                                        placeholder="000000"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        className="w-full px-5 py-5 text-center text-3xl font-black tracking-[0.5em] rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                                    />
                                </div>

                                {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}

                                <button 
                                    type="submit"
                                    disabled={isLoading || code.length < 6}
                                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                                >
                                    {isLoading ? "Verifying..." : "Verify & Sign In"}
                                </button>

                                <button 
                                    type="button"
                                    onClick={() => setStep("email")}
                                    className="w-full text-xs text-slate-500 hover:text-white transition-colors font-bold"
                                >
                                    Use a different email
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="mt-8 text-center">
                        <Link href="/" className="text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 font-bold group">
                            <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">arrow_back</span>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
