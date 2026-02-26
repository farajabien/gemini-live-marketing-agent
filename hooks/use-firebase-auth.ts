/**
 * Firebase Authentication Hook
 *
 * Replaces InstantDB auth with Firebase Authentication.
 * Provides a compatible API with the existing useAuth hook.
 */

import { useState, useEffect } from 'react';
import {
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getIdToken,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase-config';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface User {
  id: string;
  email?: string | null;
  imageURL?: string;
  planId?: string;
  type?: string;
  lifetimeGenerations?: number;
  monthlyGenerations?: number;
  generationResetDate?: number;
  isGuest?: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  error: Error | null;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  refreshToken?: string;
}

/**
 * Hook for Firebase Authentication
 * Compatible with InstantDB's useAuth API
 */
export function useFirebaseAuth(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | undefined>(undefined);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        setFirebaseUser(fbUser);
        setIsAuthLoading(false);

        if (fbUser) {
          // Get ID token for API calls
          const token = await getIdToken(fbUser);
          setRefreshToken(token);
        } else {
          setRefreshToken(undefined);
          setUser(null);
        }
      },
      (err) => {
        console.error('Auth state change error:', err);
        setError(err as Error);
        setIsAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to user document changes
  useEffect(() => {
    if (!firebaseUser) {
      setUser(null);
      setIsUserDataLoading(false);
      return;
    }

    setIsUserDataLoading(true);

    const userDocRef = doc(db, 'users', firebaseUser.uid);

    // Subscribe to user document
    const unsubscribe = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          setUser({
            id: snapshot.id,
            email: firebaseUser.email,
            isGuest: firebaseUser.isAnonymous,
            ...userData,
          } as User);
        } else {
          // Create user document if it doesn't exist
          const newUser: Partial<User> = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            isGuest: firebaseUser.isAnonymous,
            planId: 'free',
            type: firebaseUser.isAnonymous ? 'guest' : 'user',
            lifetimeGenerations: 0,
            monthlyGenerations: 0,
            generationResetDate: Date.now(),
          };

          await setDoc(userDocRef, newUser);
          setUser(newUser as User);
        }

        setIsUserDataLoading(false);
      },
      (err) => {
        console.error('Error fetching user document:', err);
        setError(err as Error);
        setIsUserDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  /**
   * Sign in anonymously (guest user)
   */
  const signInAsGuest = async () => {
    setIsSigningIn(true);
    setError(null);

    try {
      const userCredential = await signInAnonymously(auth);
      console.log('Guest sign-in successful:', userCredential.user.uid);

      // Create user document
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          id: userCredential.user.uid,
          email: null,
          isGuest: true,
          planId: 'free',
          type: 'guest',
          lifetimeGenerations: 0,
          monthlyGenerations: 0,
          generationResetDate: Date.now(),
        });
      }
    } catch (err) {
      console.error('Failed to sign in as guest:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
      setRefreshToken(undefined);
    } catch (err) {
      console.error('Failed to sign out:', err);
      setError(err as Error);
      throw err;
    }
  };

  return {
    user,
    isLoading: isAuthLoading || isSigningIn,
    isInitialLoading: isAuthLoading || isSigningIn || (firebaseUser ? isUserDataLoading : false),
    error,
    signInAsGuest,
    signOut,
    isAuthenticated: !!firebaseUser,
    refreshToken,
  };
}

// Export as default for compatibility
export { useFirebaseAuth as useAuth };
