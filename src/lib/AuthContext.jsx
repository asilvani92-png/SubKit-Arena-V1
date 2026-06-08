import React, { createContext, useContext, useEffect, useState } from 'react';

import supabase from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const applySessionUser = async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    setUser({ ...sessionUser, ...profile });
    setIsAuthenticated(true);
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      if (typeof window !== 'undefined' && (window.location.search.includes('access_token') || window.location.hash.includes('access_token'))) {
        const { data: redirectData, error: redirectError } = await supabase.auth.getSessionFromUrl();
        if (redirectError) {
          console.warn('Supabase redirect session error:', redirectError);
        } else if (redirectData?.session) {
          const cleanedUrl = new URL(window.location.href);
          cleanedUrl.searchParams.delete('access_token');
          cleanedUrl.searchParams.delete('refresh_token');
          cleanedUrl.searchParams.delete('type');
          cleanedUrl.searchParams.delete('expires_in');
          cleanedUrl.hash = '';
          window.history.replaceState({}, document.title, cleanedUrl.toString());
        }
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      await applySessionUser(data?.user || null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkUserAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user || null).finally(() => {
        setIsLoadingAuth(false);
        setAuthChecked(true);
        setAuthError(null);
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
