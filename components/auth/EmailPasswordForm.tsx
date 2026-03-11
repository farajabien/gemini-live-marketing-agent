"use client";

import { useState } from "react";

interface EmailPasswordFormProps {
  mode: "login" | "register";
  onSubmit: (email: string, password: string) => Promise<void>;
  onToggleMode?: () => void;
  onForgotPassword?: (email: string) => void;
  className?: string;
}

export function EmailPasswordForm({
  mode,
  onSubmit,
  onToggleMode,
  onForgotPassword,
  className,
}: EmailPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(email, password);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(friendlyError(raw));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${className ?? ""}`}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
            Email Address
          </label>
          <input
            type="email"
            required
            autoFocus
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-medium"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
            Password
          </label>
          <input
            type="password"
            required
            placeholder={mode === "register" ? "Create a password (min 6 chars)" : "Password"}
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
        {isLoading
          ? mode === "login"
            ? "Signing In..."
            : "Creating Account..."
          : mode === "login"
            ? "Sign In"
            : "Create Account"}
      </button>

      {mode === "login" && onForgotPassword && (
        <button
          type="button"
          onClick={() => onForgotPassword(email)}
          className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors font-bold text-center"
        >
          Forgot password?
        </button>
      )}

      {onToggleMode && (
        <button
          type="button"
          onClick={onToggleMode}
          className="w-full text-xs text-slate-400 hover:text-white transition-colors font-bold text-center"
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      )}
    </form>
  );
}

function friendlyError(message: string): string {
  if (message.includes("auth/wrong-password") || message.includes("auth/invalid-credential"))
    return "Incorrect email or password.";
  if (message.includes("auth/user-not-found"))
    return "No account found with that email.";
  if (message.includes("auth/email-already-in-use"))
    return "An account with that email already exists. Try signing in.";
  if (message.includes("auth/weak-password"))
    return "Password is too weak. Use at least 6 characters.";
  if (message.includes("auth/too-many-requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (message.includes("auth/network-request-failed"))
    return "Network error. Check your connection and try again.";
  return message;
}
