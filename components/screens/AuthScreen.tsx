"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase-config";
import { toast } from "sonner";
import Image from "next/image";

export function AuthScreen() {
    const { signInAsGuest, signInWithEmail, signUpWithEmail } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<"login" | "register">("login");

    const handleAuth = async (email: string, password: string) => {
        if (step === "register") {
            await signUpWithEmail(email, password);
        } else {
            await signInWithEmail(email, password);
        }
        router.refresh();
    };

    const handleForgotPassword = async (email: string) => {
        if (!email) {
            toast.error("Enter your email address first");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success("Password reset email sent! Check your inbox.");
        } catch {
            toast.error("Could not send reset email. Check the address and try again.");
        }
    };

    const handleGuestSignIn = async () => {
        await signInAsGuest();
        router.refresh();
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0d] flex flex-col relative overflow-hidden">
            <Header />
            
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
                        <EmailPasswordForm
                            mode={step}
                            onSubmit={handleAuth}
                            onToggleMode={() => setStep(step === "login" ? "register" : "login")}
                            onForgotPassword={handleForgotPassword}
                        />

                        <div className="relative mt-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-[#12121a] px-4 text-slate-500">Or continue with</span></div>
                        </div>

                        <button 
                            type="button"
                            onClick={handleGuestSignIn}
                            className="w-full mt-6 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95 text-sm"
                        >
                            Guest Account
                        </button>
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
