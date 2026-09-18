import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/qhse/AppLayout';
import Dashboard from '@/pages/Dashboard';
import MesNC from '@/pages/MesNC';
import NCTraiter from '@/pages/NCTraiter';
import MesAC from '@/pages/MesAC';
import ACTraiter from '@/pages/ACTraiter';
import CreateNC from '@/pages/CreateNC';
import CreateAC from '@/pages/CreateAC';
import NCDetail from '@/pages/NCDetail';
import ACDetail from '@/pages/ACDetail';
import TraitementNC from '@/pages/TraitementNC';
import TraitementAC from '@/pages/TraitementAC';
import Notifications from '@/pages/Notifications';
import Parametres from '@/pages/Parametres';
import Journal from '@/pages/Journal';
import MonProcessus from '@/pages/MonProcessus';

// Redirection d'accueil : les administrateurs (gestion membres) atterrissent sur les Paramètres
const HomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user?.role === "admin_gestion" ? "/Parametres" : "/Dashboard"} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<AppLayout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/MesNC" element={<MesNC />} />
        <Route path="/NCTraiter" element={<NCTraiter />} />
        <Route path="/MesAC" element={<MesAC />} />
        <Route path="/ACTraiter" element={<ACTraiter />} />
        <Route path="/CreateNC" element={<CreateNC />} />
        <Route path="/CreateAC" element={<CreateAC />} />
        <Route path="/NCDetail" element={<NCDetail />} />
        <Route path="/ACDetail" element={<ACDetail />} />
        <Route path="/TraitementNC" element={<TraitementNC />} />
        <Route path="/TraitementAC" element={<TraitementAC />} />
        <Route path="/Notifications" element={<Notifications />} />
        <Route path="/Parametres" element={<Parametres />} />
        <Route path="/Journal" element={<Journal />} />
        <Route path="/MonProcessus" element={<MonProcessus />} />
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