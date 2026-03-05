"use client";

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getIdToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  linkAnonymousToEmail: (email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  refreshToken?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | undefined>(undefined);

  // Handle mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        setFirebaseUser(fbUser);
        setIsAuthLoading(false);

        if (fbUser) {
          try {
            // Get ID token for API calls
            const token = await getIdToken(fbUser);
            setRefreshToken(token);
          } catch (tokenErr) {
            console.error('Failed to get ID token:', tokenErr);
          }
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

  // Track whether we've already attempted to create the user doc
  // to prevent infinite retry loops from onSnapshot
  const hasAttemptedCreate = useRef(false);

  // Listen to user document changes
  useEffect(() => {
    if (!firebaseUser) {
      setUser(null);
      setIsUserDataLoading(false);
      hasAttemptedCreate.current = false;
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
        } else if (!hasAttemptedCreate.current) {
          // Create user document if it doesn't exist (only try once)
          hasAttemptedCreate.current = true;
          const newUser: Partial<User & { userId: string }> = {
            id: firebaseUser.uid,
            userId: firebaseUser.uid,
            email: firebaseUser.email,
            isGuest: firebaseUser.isAnonymous,
            planId: 'free',
            type: firebaseUser.isAnonymous ? 'guest' : 'user',
            lifetimeGenerations: 0,
            monthlyGenerations: 0,
            generationResetDate: Date.now(),
          };

          try {
            await setDoc(userDocRef, newUser);
            // onSnapshot will fire again with the new doc, setting user state
          } catch (docErr) {
            console.error('Failed to create user document:', docErr);
            // Even if document creation fails, we still have the auth user
            setUser(newUser as User);
          }
        } else {
          // Already attempted creation and doc still doesn't exist
          // Set user from auth data only
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            isGuest: firebaseUser.isAnonymous,
            planId: 'free',
            type: firebaseUser.isAnonymous ? 'guest' : 'user',
            lifetimeGenerations: 0,
            monthlyGenerations: 0,
            generationResetDate: Date.now(),
          } as User);
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
          userId: userCredential.user.uid,
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

  /**
   * Sign in with Email and Password
   */
  const signInWithEmail = async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Failed to sign in with email:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Sign up with Email and Password
   */
  const signUpWithEmail = async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create user document
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        id: userCredential.user.uid,
        userId: userCredential.user.uid,
        email: userCredential.user.email,
        isGuest: false,
        planId: 'free',
        type: 'user',
        lifetimeGenerations: 0,
        monthlyGenerations: 0,
        generationResetDate: Date.now(),
      });
    } catch (err) {
      console.error('Failed to sign up with email:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Link anonymous account to email/password
   * Converts a guest user to a permanent email account, preserving their UID and data
   */
  const linkAnonymousToEmail = async (email: string, password: string) => {
    if (!firebaseUser || !firebaseUser.isAnonymous) {
      throw new Error('No anonymous user to link');
    }

    setIsSigningIn(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(firebaseUser, credential);

      // Update the user document to reflect the upgrade
      const userDocRef = doc(db, 'users', result.user.uid);
      await setDoc(userDocRef, {
        email: result.user.email,
        isGuest: false,
        type: 'user',
      }, { merge: true });
    } catch (err) {
      console.error('Failed to link anonymous account:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  const value = {
    user,
    isLoading: isAuthLoading || isSigningIn,
    isInitialLoading: !mounted || isAuthLoading || isSigningIn || (firebaseUser ? isUserDataLoading : false),
    error,
    signInAsGuest,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    linkAnonymousToEmail,
    isAuthenticated: !!firebaseUser,
    refreshToken,
  };

  if (!mounted) {
    return null; // Or a simple loader to prevent hydration "glitches"
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
