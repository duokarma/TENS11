import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'Owner' | 'Manager' | 'Receptionist';

interface UserProfile {
  id: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isDkOwner: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── DuoKarma Owner Bypass Helpers ─────────────────────────────────
const DK_OWNER_KEY = 'dk_owner_session';
function getDkOwner(): string | null {
  try { return localStorage.getItem(DK_OWNER_KEY); } catch { return null; }
}
export function setDkOwnerSession(name: string) {
  try { localStorage.setItem(DK_OWNER_KEY, name); } catch {}
}
export function clearDkOwnerSession() {
  try { localStorage.removeItem(DK_OWNER_KEY); } catch {}
}
// ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDkOwner, setIsDkOwner] = useState<boolean>(() => !!getDkOwner());

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else if (getDkOwner()) {
        // DuoKarma owner bypass active
        setIsDkOwner(true);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else if (!getDkOwner()) {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      setProfile(data as UserProfile | null);
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    clearDkOwnerSession();
    setIsDkOwner(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, isDkOwner, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
