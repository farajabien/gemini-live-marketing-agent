"use client";

import { useAuth } from "@/hooks/use-auth";
import { getTierConfig, PRICING_TIERS } from "@/lib/pricing";
import { startOfMonth } from "date-fns";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase-config";
import { toast } from "sonner";

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSecurity?: () => void;
}

export function ProfileDialog({ isOpen, onClose, onOpenSecurity }: ProfileDialogProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [linkStep, setLinkStep] = useState<'none' | 'confirm_logout'>('none');

  const handleClose = () => {
    setLinkStep('none');
    setAccessCode("");
    setIsUpgrading(false);
    onClose();
  };

  const [accessCode, setAccessCode] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgradeWithCode = async () => {
    if (!user || !accessCode) return;
    
    const masterCode = process.env.NEXT_PUBLIC_HACKATHON_ACCESS_CODE;
    if (accessCode.trim() !== masterCode) {
      toast.error("Invalid access code");
      return;
    }

    setIsUpgrading(true);
    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        planId: 'pro_max',
        type: 'user'
      });
      toast.success("Welcome to Pro Max! Plan upgraded.");
      setAccessCode("");
      // The onSnapshot in AuthProvider will pick up the change
    } catch (err) {
      console.error("Failed to upgrade plan:", err);
      toast.error("Failed to upgrade plan. Please try again.");
    } finally {
      setIsUpgrading(false);
    }
  };

  if (!isOpen || !user) return null;

  const isGuest = !user.email;

  const currentTier = getTierConfig((user && 'planId' in user ? user.planId : undefined) || "free");
  const limit = currentTier.videos;

  // Get generation counts from user entity
  const currentMonthStartUTC = startOfMonth(new Date()).getTime();
  const needsReset = ((user && 'generationResetDate' in user ? user.generationResetDate : 0) ?? 0) < currentMonthStartUTC;
  
  // If reset needed, effective monthly usage is 0
  const monthlyUsage = needsReset ? 0 : ((user && 'monthlyGenerations' in user ? user.monthlyGenerations : 0) ?? 0);
  const lifetimeUsage = ((user && 'lifetimeGenerations' in user ? user.lifetimeGenerations : 0) ?? 0);
  
  const percentage = Math.min((monthlyUsage / limit) * 100, 100);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white/80 dark:bg-[#101322]/90 backdrop-blur-xl rounded-[2rem] w-full max-w-md shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] overflow-hidden border border-white/20 dark:border-white/5 scale-100 flex flex-col max-h-[90vh]">
        
        {/* Profile Header */}
        <div className="relative p-8 pt-10 flex flex-col items-center text-center gap-4 bg-gradient-to-b from-red-500/5 to-transparent shrink-0">
            {/* Close Button */}
            <button 
                onClick={handleClose} 
                className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all hover:rotate-90"
            >
                <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Avatar with Glow */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-700 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center text-3xl font-bold shadow-xl border-4 border-white dark:border-black">
                    {user.email ? user.email.charAt(0).toUpperCase() : "G"}
                </div>
            </div>

            <div className="space-y-1">
                <h2 className="font-bold text-xl text-slate-900 dark:text-white">
                    {user.email || "Guest User"}
                </h2>
                <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-600 text-white uppercase tracking-widest shadow-lg shadow-red-500/20">
                        {currentTier.name} Member
                    </span>
                </div>
            </div>
        </div>

        {/* Usage & Features (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-8 min-h-0 custom-scrollbar">
            {/* Monthly Limit Visualization */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Monthly Quota</span>
                        <p className="text-[10px] text-slate-500 font-medium">Resets in 28 days</p>
                    </div>
                    <span className="text-sm font-black text-red-600 dark:text-red-400">
                        {monthlyUsage} <span className="text-slate-400 font-medium">/ {limit}</span>
                    </span>
                </div>
                
                <div className="relative h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(220,38,38,0.4)]`} 
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                
                {/* Lifetime Stats */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-white/5">
                    <span className="text-xs font-medium text-slate-500">Total Lifetime Generations</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{lifetimeUsage}</span>
                </div>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Included Features</h3>
                <div className="grid grid-cols-1 gap-3">
                    {currentTier.features.map((feature: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-hover hover:scale-[1.02]">
                             <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-green-500 text-sm font-bold">check</span>
                             </div>
                             <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Hackathon Access Code */}
            {user && 'planId' in user && user.planId !== 'pro_max' && (
                <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hackathon Access</h3>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            placeholder="Enter access code"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                        />
                        <button
                            onClick={handleUpgradeWithCode}
                            disabled={isUpgrading || !accessCode}
                            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isUpgrading ? "..." : "Apply"}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* CTA & Actions (Fixed) */}
        <div className="px-8 pb-8 pt-4 shrink-0 bg-gradient-to-t from-white dark:from-[#101322] via-white/80 dark:via-[#101322]/80 to-transparent">
            {linkStep === 'none' && (
                <div className="space-y-4">
                    <button 
                        onClick={() => {
                            if (user && 'planId' in user && user.planId === 'pro') {
                                window.open('mailto:hello@fbien.com?subject=Request More Credits');
                            } else {
                                handleClose();
                                router.push('/upgrade');
                            }
                        }}
                        className="group relative w-full overflow-hidden rounded-2xl bg-[#1337ec] p-px transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative flex items-center justify-center gap-2 bg-red-600 rounded-[15px] py-4 px-6 font-bold text-white transition-all group-hover:bg-red-700">
                            <span>{user && 'planId' in user && user.planId === 'pro' ? (monthlyUsage >= limit ? 'Contact for More 💎' : 'Change Plan') : 'Upgrade to Pro'}</span>
                            {!(user && 'planId' in user && user.planId === 'pro') && (
                                <>
                                    <span className="text-blue-200/60 font-medium">•</span>
                                    <span className="text-sm">${PRICING_TIERS.PRO.price}</span>
                                </>
                            )}
                        </div>
                    </button>
                    {user && 'planId' in user && user.planId === 'pro' && (
                        <p className="text-[10px] text-center text-slate-400 font-medium">
                            You are already on the most powerful plan! {monthlyUsage >= limit ? "Need more? Just ask." : ""}
                        </p>
                    )}
                    
                    <button 
                        onClick={() => {
                            if (isGuest) setLinkStep('confirm_logout');
                            else signOut();
                        }}
                        className="w-full text-xs text-slate-400 hover:text-red-500 font-bold transition-colors py-2 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        Sign Out of Account
                    </button>
                </div>
            )}

            {/* Confirm Logout Warning for Guests */}
            {linkStep === 'confirm_logout' && (
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3 text-red-500">
                         <span className="material-symbols-outlined">warning</span>
                         <p className="text-sm font-black uppercase tracking-tight">Security Alert</p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Wait! You are using a guest account. If you sign out now, you will <span className="text-red-500 font-bold">permanently lose access</span> to your projects and your free video.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                         <button
                            onClick={() => {
                                onOpenSecurity?.();
                                handleClose();
                            }}
                            className="w-full py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                         >
                            Secure My Account (Recommended)
                         </button>
                         <button
                            onClick={() => signOut()}
                            className="w-full py-3 text-slate-400 hover:text-red-500 font-bold text-xs transition-colors"
                         >
                            Sign Out Anyway
                         </button>
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
