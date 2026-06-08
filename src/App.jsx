import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Home from '@/pages/Home';
import Catalogue from '@/pages/Catalogue';
import Collection from '@/pages/Collection';
import Matches from '@/pages/Matches';
import League from '@/pages/League';
import Admin from '@/pages/Admin';
import GameArena from '@/pages/GameArena';
import Worlds from '@/pages/Worlds';
import FindMatch from '@/pages/FindMatch';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const PublicRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
          <span className="font-heading text-xs text-muted-foreground tracking-widest">LOADING SUBKIT...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  if (!isAuthenticated) {
    return <PublicRoutes />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout user={user} />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/match/:matchId/arena" element={<GameArena />} />
        <Route path="/worlds" element={<Worlds />} />
        <Route path="/find" element={<FindMatch />} />
        <Route path="/league" element={<League />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
