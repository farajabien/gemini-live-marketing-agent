
import { db } from "@/lib/instant-client";
import { useEffect, useState } from "react";

export function useAuth() {
  const { user: authUser, isLoading: isAuthLoading, error: authError } = db.useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Fetch full user entity from $users
  const userQuery = authUser ? { $users: { $: { where: { id: authUser.id } } } } : null;
  const { data: userData, isLoading: isUserDataLoading, error: userQueryError } = db.useQuery(userQuery);

  const user = (userData && '$users' in userData ? userData.$users?.[0] : undefined) || authUser;

  const signInAsGuest = async () => {
    setIsSigningIn(true);
    try {
      await db.auth.signInAsGuest();
    } catch (err) {
      console.error("Failed to sign in as guest:", err);
      // Log more context for the "Record not found: app-user" error if it happens during guest sign-in
      if (err instanceof Error && err.message.includes("app-user")) {
        console.error("InstantDB app-user error context:", { 
          appId: (db as any)._appId, 
          timestamp: new Date().toISOString() 
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    await db.auth.signOut();
  };

  return {
    user,
    isLoading: isAuthLoading || isSigningIn,
    isInitialLoading: isAuthLoading || isSigningIn || (authUser ? isUserDataLoading : false),
    error: authError || userQueryError,
    signInAsGuest,
    signOut,
    isAuthenticated: !!authUser,
    refreshToken: (authUser as any)?.refresh_token,
  };
}
