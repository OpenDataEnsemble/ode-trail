import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TrailProvider } from './context/TrailContext';
import { HomeScreen } from './screens/HomeScreen';
import { AboutScreen, AgendaScreen } from './screens/StaticScreens';
import { FacesScreen, LeaderboardScreen } from './screens/CommunityScreens';

export default function App() {
  return (
    <HashRouter>
      <TrailProvider>
        <main id="trail">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/agenda" element={<AgendaScreen />} />
            <Route path="/about" element={<AboutScreen />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route path="/faces" element={<FacesScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </TrailProvider>
    </HashRouter>
  );
}
