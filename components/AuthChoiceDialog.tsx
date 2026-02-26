"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { db } from "@/lib/instant-client";

interface AuthChoiceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onContinueAsGuest: () => void;
}

export function AuthChoiceDialog({ isOpen, onClose, onContinueAsGuest }: AuthChoiceDialogProps) {
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"choice" | "email" | "code">("choice");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await db.auth.sendMagicCode({ email });
            setStep("code");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to send code.";
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
            onClose();
            // Generation will resume via useEffect or user can click again
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Invalid code.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-[#101322] border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-300 relative">
                
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-white transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                {step === "choice" && (
                    <div className="text-center space-y-8 py-4">
                        <div className="space-y-3">
                            <div className="h-16 w-16 bg-red-600/10 rounded-3xl mx-auto flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-red-500 font-bold">magic_button</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Ready to Create?</h2>
                            <p className="text-sm text-slate-500 dark:text-[#929bc9] font-medium leading-relaxed">
                                Sign in to save your progress and access your projects from any device.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => setStep("email")}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm"
                            >
                                Sign In with Magic Link
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95 text-sm"
                            >
                                Not Now
                            </button>
                        </div>
                    </div>
                )}

                {step === "email" && (
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <div className="text-center space-y-2 mb-6">
                            <h2 className="text-2xl font-black text-white">Enter Email</h2>
                            <p className="text-sm text-slate-400">We'll send you a secure login code.</p>
                        </div>
                        
                        <div className="space-y-2">
                            <input 
                                type="email"
                                required
                                autoFocus
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium text-center"
                            />
                        </div>

                        {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}

                        <button 
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                        >
                            {isLoading ? "Sending Code..." : "Send Magic Code"}
                        </button>

                        <button 
                            type="button"
                            onClick={() => setStep("choice")}
                            className="w-full text-xs text-slate-500 hover:text-white transition-colors font-bold"
                        >
                            Back to options
                        </button>
                    </form>
                )}

                {step === "code" && (
                    <form onSubmit={handleVerifyCode} className="space-y-6">
                        <div className="text-center space-y-2 mb-6">
                            <h2 className="text-2xl font-black text-white">Verify Code</h2>
                            <p className="text-sm text-slate-400">Enter the 6-digit code sent to<br/><span className="text-red-400 font-bold">{email}</span></p>
                        </div>
                        
                        <div className="space-y-4">
                            <input 
                                type="text"
                                required
                                autoFocus
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
                            Try a different email
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
