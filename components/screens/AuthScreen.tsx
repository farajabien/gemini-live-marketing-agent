"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import Image from "next/image";

export function AuthScreen() {
    const { signInAsGuest, signInWithEmail, signUpWithEmail } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [step, setStep] = useState<"login" | "register">("login");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuthAction = async (e: React.FormEvent, isRegister: boolean) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (isRegister) {
                await signUpWithEmail(email, password);
            } else {
                await signInWithEmail(email, password);
            }
            window.location.reload();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : `Failed to ${isRegister ? 'register' : 'sign in'}. Please try again.`;
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
                       <Image src="/logos/ideatovideo-icon.png" alt="Logo" width={100} height={100} className="mx-auto w-8 h-auto" style={{ height: 'auto' }}/>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-3">Claim your voice</h1>
                        <p className="text-slate-400">Sign in to start your founder narrative and generate your first batch of content.</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                        <form onSubmit={(e) => handleAuthAction(e, step === "register")} className="space-y-6">
                            <div className="space-y-4">
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
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Password</label>
                                    <input 
                                        type="password"
                                        required
                                        placeholder="Password"
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            
                            {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}

                            <button 
                                type="submit"
                                disabled={isLoading || !email || password.length < 6}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                            >
                                {isLoading ? (step === "login" ? "Signing In..." : "Creating Account...") : (step === "login" ? "Sign In" : "Create Account")}
                            </button>

                            <button 
                                type="button"
                                onClick={() => setStep(step === "login" ? "register" : "login")}
                                className="w-full text-xs text-slate-400 hover:text-white transition-colors font-bold text-center"
                            >
                                {step === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
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
