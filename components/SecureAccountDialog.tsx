"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { useState, useEffect } from "react";

interface SecureAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecureAccountDialog({ isOpen, onClose }: SecureAccountDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset states when closed
  useEffect(() => {
    if (!isOpen) {
        setStep('email');
        setEmail("");
        setCode("");
        setError(null);
        setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSendCode = async () => {
    setIsLinking(true);
    setError(null);
    try {
        await db.auth.sendMagicCode({ email });
        setStep('code');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send code.";
        setError(message);
    } finally {
        setIsLinking(false);
    }
  };

  const handleVerify = async () => {
    setIsLinking(true);
    setError(null);
    try {
        await db.auth.signInWithMagicCode({ email, code });
        setSuccess(true);
        setTimeout(() => {
            onClose();
            window.location.reload();
        }, 1500);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Code failed. Try again.";
        setError(message);
    } finally {
        setIsLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#101322] rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden border border-white/10 scale-100 flex flex-col p-8 relative">
        
        {/* Close Button */}
        <button 
            onClick={onClose} 
            className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-white transition-all shadow-sm"
        >
            <span className="material-symbols-outlined text-lg">close</span>
        </button>

        <div className="flex flex-col items-center text-center gap-6">
            {/* Header Icon */}
            <div className="h-16 w-16 rounded-3xl bg-red-600/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-red-500 font-bold">
                    {success ? 'verified' : step === 'email' ? 'shield_person' : 'mark_email_read'}
                </span>
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {success ? "Account Secured!" : step === 'email' ? "Secure Your Account" : "Verify Your Email"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#929bc9] font-medium leading-relaxed">
                    {success 
                        ? "Great! Your projects are now tied to your email and accessible from anywhere."
                        : step === 'email' 
                            ? "Save your free video and sync projects across devices. We'll send a quick magic code." 
                            : `Enter the 6-digit code we sent to ${email}`}
                </p>
            </div>

            <div className="w-full space-y-4 pt-2">
                {step === 'email' && !success && (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <input 
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
                            />
                        </div>
                        {error && <p className="text-[10px] text-red-500 font-bold text-left px-1">{error}</p>}
                        <button
                            disabled={isLinking || !email}
                            onClick={handleSendCode}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                        >
                            {isLinking ? "Sending Magic Code..." : "Send Magic Code"}
                        </button>
                    </div>
                )}

                {step === 'code' && !success && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <input 
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-5 py-4 text-center text-2xl font-black tracking-[0.5em] rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                            />
                        </div>
                        {error && <p className="text-[10px] text-red-500 font-bold text-center">{error}</p>}
                        <div className="flex flex-col gap-3">
                            <button
                                disabled={isLinking || code.length < 6}
                                onClick={handleVerify}
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                            >
                                {isLinking ? "Verifying..." : "Secure Account"}
                            </button>
                            <button 
                                onClick={() => setStep('email')}
                                className="text-xs text-slate-400 hover:text-white transition-colors font-bold"
                            >
                                Wrong email? Try again
                            </button>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="flex flex-col items-center py-4 text-green-500">
                        <div className="flex items-center gap-2 font-black">
                            <span className="material-symbols-outlined">check_circle</span>
                            Success
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
