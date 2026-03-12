"use client";

import { useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from "@/hooks/use-auth";
import { PRICING_TIERS } from "@/lib/pricing";
import { SecureAccountDialog } from "@/components/SecureAccountDialog";

export function UpgradeScreen() {
  const { user, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  // Only redirect if already Pro Max (top tier)
  if ((user && 'planId' in user && user.planId === "pro_max") && !success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0a0a0d]">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[3rem] text-center max-w-lg">
            <span className="material-symbols-outlined text-green-500 text-6xl mb-6">workspace_premium</span>
            <h1 className="text-3xl font-black text-white mb-4">You&apos;re already Pro Max!</h1>
            <p className="text-slate-400 mb-8">You have full access to cinematic b-roll scenes and high-quality MP4 exports.</p>
            <Link href="/" className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all">
                Go to Dashboard
            </Link>
        </div>
      </div>
    );
  }

  // Check if user is already Pro (allow upgrade to Pro Max)
  const isPro = user && 'planId' in user && user.planId === "pro";

  return (
    <div className="min-h-full bg-[#0a0a0d] relative overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col items-center py-20 px-4">
      {/* Background Glows */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-40 -right-20 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-4xl w-full z-10">
        <header className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                    {isPro ? "Upgrade to Pro Max" : "Unlock your potential"}
                </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                {isPro ? (
                    <>
                        Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Cinematic B-Roll</span>
                    </>
                ) : (
                    <>
                        Level Up Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Content Engine</span>
                    </>
                )}
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                {isPro 
                    ? "You're Pro! Upgrade to Pro Max for AI-generated video clips that bring your scenes to life with cinematic motion."
                    : "Stop worrying about limits. Create high-quality, professional videos and carousels at scale."}
            </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Free Tier Info */}
            <div className={`p-10 rounded-[2.5rem] bg-white/5 border border-white/5 backdrop-blur-lg flex flex-col h-full ${!user || (user && !('planId' in user)) ? '' : 'grayscale opacity-60'}`}>
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-white mb-2">{PRICING_TIERS.FREE.name}</h3>
                    <p className="text-slate-400 text-sm">{PRICING_TIERS.FREE.description}</p>
                </div>
                <div className="text-4xl font-black text-white mb-8">${PRICING_TIERS.FREE.price}<span className="text-lg text-slate-500 font-medium">/mo</span></div>
                
                <ul className="space-y-4 mb-10 flex-1">
                   {PRICING_TIERS.FREE.features.map((f, i) => (
                       <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                           <span className="material-symbols-outlined text-slate-500 text-lg">check_circle</span>
                           {f}
                       </li>
                   ))}
                </ul>

                {!user || (user && !('planId' in user)) ? (
                    <button disabled className="w-full py-4 rounded-2xl bg-white/10 text-white font-bold">
                        Current Plan
                    </button>
                ) : (
                    <button disabled className="w-full py-4 rounded-2xl bg-white/5 text-slate-500 font-bold">
                        Basic Tier
                    </button>
                )}
            </div>

            {/* Pro Tier Card */}
            <div className={`relative p-px rounded-[2.5rem] ${isPro ? 'bg-gradient-to-b from-green-500 to-emerald-600' : 'bg-gradient-to-b from-red-500 to-red-700'} shadow-[0_32px_64px_-12px_rgba(220,38,38,0.3)] group h-full`}>
                {isPro ? (
                    <div className="absolute -top-4 right-8 bg-green-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Current Plan
                    </div>
                ) : (
                    <div className="absolute -top-4 right-8 bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest animate-bounce">
                        Most Popular
                    </div>
                )}
                
                <div className="bg-black p-10 rounded-[2.45rem] flex flex-col h-full">
                    <div className="mb-8 font-bold">
                        <h3 className="text-xl text-white mb-2">{PRICING_TIERS.PRO.name}</h3>
                        <p className="text-slate-400 text-base leading-relaxed">{PRICING_TIERS.PRO.description}</p>
                    </div>
                    
                    <div className="text-5xl font-black text-white mb-8 mt-4">
                        ${PRICING_TIERS.PRO.price}
                        <span className="text-xl text-slate-500 font-medium tracking-normal ml-2">/mo</span>
                    </div>

                    <ul className="space-y-4 mb-10 flex-1">
                        {PRICING_TIERS.PRO.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-3 text-base text-slate-100 font-medium">
                                <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-red-500 text-lg font-bold">check</span>
                                </div>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {isPro ? (
                        <button disabled className="w-full py-4 bg-green-500/20 border-2 border-green-500 text-green-400 font-black rounded-2xl text-center flex items-center justify-center gap-2">
                             <span className="material-symbols-outlined">check_circle</span>
                             Active Plan
                        </button>
                    ) : !success ? (
                        <div className="space-y-4">
                             {user ? (
                                 user.email ? (
                                     <PayPalButtons
                                         style={{ 
                                             layout: "vertical", 
                                             shape: "rect", 
                                             label: "pay",
                                             height: 52
                                         }}
                                         createOrder={async () => {
                                             try {
                                                 const res = await fetch("/api/paypal/create-order", {
                                                     method: "POST",
                                                     headers: { "Content-Type": "application/json" },
                                                     body: JSON.stringify({ userId: user.id, tier: "pro" })
                                                 });
                                                 const data = await res.json();
                                                 if (data.error) throw new Error(data.error);
                                                 return data.orderId;
                                             } catch (err: unknown) {
                                                 const message = err instanceof Error ? err.message : "Failed to create order";
                                                 setError(message);
                                                 throw err;
                                             }
                                         }}
                                         onApprove={async (data) => {
                                             try {
                                                 const res = await fetch("/api/paypal/capture-order", {
                                                     method: "POST",
                                                     headers: { "Content-Type": "application/json" },
                                                     body: JSON.stringify({ orderId: data.orderID, userId: user.id, tier: "pro" })
                                                 });
                                                 const result = await res.json();
                                                 if (result.success) {
                                                     setSuccess(true);
                                                     window.location.reload(); // Refresh to update user plan globally
                                                 } else {
                                                     setError(result.error);
                                                 }
                                             } catch (err: unknown) {
                                                 const message = err instanceof Error ? err.message : "Payment capture failed.";
                                                 setError(message);
                                             }
                                         }}
                                     />
                                 ) : (
                                    <div className="p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center space-y-4">
                                        <p className="text-sm text-orange-200 font-medium">Link your email to keep your Pro features safe.</p>
                                        <button 
                                            onClick={() => setSecurityOpen(true)}
                                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg"
                                        >
                                            Secure Account & Upgrade
                                        </button>
                                        <p className="text-[10px] text-slate-500 italic">Click your profile avatar in the header to add your email.</p>
                                    </div>
                                 )
                             ) : (
                                <Link href="/" className="w-full h-[52px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center">
                                    Sign In to Upgrade
                                </Link>
                             )}
                            {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}
                        </div>
                    ) : (
                        <div className="w-full py-4 bg-green-500 text-white font-black rounded-lg text-center flex items-center justify-center gap-2">
                             <span className="material-symbols-outlined">celebration</span>
                             Upgraded to Pro!
                        </div>
                    )}
                </div>
            </div>

            {/* Pro Max Tier Card */}
            <div className={`relative p-px rounded-[2.5rem] bg-gradient-to-b from-red-600 to-orange-600 shadow-[0_32px_64px_-12px_rgba(220,38,38,0.3)] group h-full ${isPro ? 'scale-105 ring-2 ring-red-500/50' : ''}`}>
                {isPro ? (
                    <div className="absolute -top-4 right-8 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest animate-pulse">
                        ⭐ Upgrade Available
                    </div>
                ) : (
                    <div className="absolute -top-4 right-8 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest">
                        Cinematic
                    </div>
                )}
                
                <div className="bg-black p-10 rounded-[2.45rem] flex flex-col h-full">
                    <div className="mb-8 font-bold">
                        <h3 className="text-xl text-white mb-2">{PRICING_TIERS.PRO_MAX.name}</h3>
                        <p className="text-slate-400 text-base leading-relaxed">{PRICING_TIERS.PRO_MAX.description}</p>
                    </div>
                    
                    <div className="text-5xl font-black text-white mb-8 mt-4">
                        ${PRICING_TIERS.PRO_MAX.price}
                        <span className="text-xl text-slate-500 font-medium tracking-normal ml-2">/mo</span>
                    </div>

                    <ul className="space-y-4 mb-10 flex-1">
                        {PRICING_TIERS.PRO_MAX.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-3 text-base text-slate-100 font-medium">
                                <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-red-500 text-lg font-bold">check</span>
                                </div>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {!success ? (
                        <div className="space-y-4">
                             {user ? (
                                 user.email ? (
                                     <PayPalButtons
                                         style={{ 
                                             layout: "vertical", 
                                             shape: "rect", 
                                             label: "pay",
                                             height: 52
                                         }}
                                         createOrder={async () => {
                                             try {
                                                 const res = await fetch("/api/paypal/create-order", {
                                                     method: "POST",
                                                     headers: { "Content-Type": "application/json" },
                                                     body: JSON.stringify({ userId: user.id, tier: "pro_max" })
                                                 });
                                                 const data = await res.json();
                                                 if (data.error) throw new Error(data.error);
                                                 return data.orderId;
                                             } catch (err: unknown) {
                                                 const message = err instanceof Error ? err.message : "Failed to create order";
                                                 setError(message);
                                                 throw err;
                                             }
                                         }}
                                         onApprove={async (data) => {
                                             try {
                                                 const res = await fetch("/api/paypal/capture-order", {
                                                     method: "POST",
                                                     headers: { "Content-Type": "application/json" },
                                                     body: JSON.stringify({ orderId: data.orderID, userId: user.id, tier: "pro_max" })
                                                 });
                                                 const result = await res.json();
                                                 if (result.success) {
                                                     setSuccess(true);
                                                     window.location.reload();
                                                 } else {
                                                     setError(result.error);
                                                 }
                                             } catch (err: unknown) {
                                                 const message = err instanceof Error ? err.message : "Payment capture failed.";
                                                 setError(message);
                                             }
                                         }}
                                     />
                                 ) : (
                                    <div className="p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center space-y-4">
                                        <p className="text-sm text-orange-200 font-medium">Link your email to keep your Pro Max features safe.</p>
                                        <button 
                                            onClick={() => setSecurityOpen(true)}
                                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg"
                                        >
                                            Secure Account & Upgrade
                                        </button>
                                        <p className="text-[10px] text-slate-500 italic">Click your profile avatar in the header to add your email.</p>
                                    </div>
                                 )
                             ) : (
                                <Link href="/" className="w-full h-[52px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center">
                                    Sign In to Upgrade
                                </Link>
                             )}
                            {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}
                        </div>
                    ) : (
                        <div className="w-full py-4 bg-green-500 text-white font-black rounded-lg text-center flex items-center justify-center gap-2">
                             <span className="material-symbols-outlined">celebration</span>
                             Upgraded to Pro Max!
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="mt-20 text-center">
            <Link href="/" className="text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 font-bold group">
                <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">arrow_back</span>
                Back to Creative Studio
            </Link>
        </div>
      </div>
      </div>
      
      <SecureAccountDialog 
        isOpen={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
    </div>
  );
}
