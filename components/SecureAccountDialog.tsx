"use client";

import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { useState, useEffect } from "react";

interface SecureAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecureAccountDialog({ isOpen, onClose }: SecureAccountDialogProps) {
  const { user, signUpWithEmail, linkAnonymousToEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset states when closed
  useEffect(() => {
    if (!isOpen) {
        setEmail("");
        setPassword("");
        setError(null);
        setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSecureAccount = async () => {
    setIsLinking(true);
    setError(null);
    try {
        // If user is a guest (anonymous), link the anonymous account to email
        // This preserves their UID and all associated Firestore data
        if (user.isGuest) {
          await linkAnonymousToEmail(email, password);
        } else {
          await signUpWithEmail(email, password);
        }
        setSuccess(true);
        setTimeout(() => {
            onClose();
            window.location.reload();
        }, 1500);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to secure account. Try again.";
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
                    {success ? 'verified' : 'shield_person'}
                </span>
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {success ? "Account Secured!" : "Secure Your Account"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#929bc9] font-medium leading-relaxed">
                    {success 
                        ? "Great! Your projects are now tied to your email and accessible from anywhere."
                        : "Save your free video and sync projects across devices by adding a password."}
                </p>
            </div>

            <div className="w-full space-y-4 pt-2">
                {!success && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <input 
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
                            />
                            <input 
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                minLength={6}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
                            />
                        </div>
                        {error && <p className="text-[10px] text-red-500 font-bold text-left px-1">{error}</p>}
                        <button
                            disabled={isLinking || !email || password.length < 6}
                            onClick={handleSecureAccount}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all text-sm disabled:opacity-50"
                        >
                            {isLinking ? "Securing Account..." : "Secure Account"}
                        </button>
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
