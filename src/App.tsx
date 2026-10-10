import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TeamProvider, useMe, useTeam } from './lib/session';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Practices from './pages/Practices';
import PracticeEditor from './pages/PracticeEditor';
import PracticePrint from './pages/PracticePrint';
import Drills from './pages/Drills';
import TacticalBoard from './pages/TacticalBoard';
import Playbook from './pages/Playbook';
import SystemDetail from './pages/SystemDetail';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import PlayerReport from './pages/PlayerReport';
import Games from './pages/Games';
import GameDetail from './pages/GameDetail';
import PriorityDetail from './pages/PriorityDetail';
import AICoach from './pages/AICoach';
import Library from './pages/Library';
import ResourceDetail from './pages/ResourceDetail';
import Calendar from './pages/Calendar';
import SettingsPage from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  const { data: me, isLoading } = useMe();
  const loc = useLocation();
  if (isLoading) return <Spinner />;
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} />
      </Routes>
    );
  }
  return (
    <TeamProvider>
      <AuthedRoutes />
    </TeamProvider>
  );
}

function AuthedRoutes() {
  const { teams, loading } = useTeam();
  if (loading) return <Spinner />;
  if (!teams.length) return <Onboarding />;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      {/* Print views render without the app chrome */}
      <Route path="/practices/:id/print" element={<PracticePrint />} />
      <Route path="/players/:id/report" element={<PlayerReport />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="teams" element={<Teams />} />
        <Route path="practices" element={<Practices />} />
        <Route path="practices/:id" element={<PracticeEditor />} />
        <Route path="drills" element={<Drills />} />
        <Route path="board" element={<TacticalBoard />} />
        <Route path="board/:id" element={<TacticalBoard />} />
        <Route path="playbook" element={<Playbook />} />
        <Route path="playbook/:id" element={<SystemDetail />} />
        <Route path="players" element={<Players />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="games" element={<Games />} />
        <Route path="games/:id" element={<GameDetail />} />
        <Route path="priorities/:id" element={<PriorityDetail />} />
        <Route path="ai" element={<AICoach />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:id" element={<ResourceDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
