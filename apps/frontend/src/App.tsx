import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { MatchesScreen } from './screens/MatchesScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { TeamDetailScreen } from './screens/TeamDetailScreen';
import { PlayerDetailScreen } from './screens/PlayerDetailScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';

export function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<MatchesScreen />} />
          <Route path="/matches/:id" element={<MatchDetailScreen />} />
          <Route path="/teams" element={<TeamsScreen />} />
          <Route path="/teams/:id" element={<TeamDetailScreen />} />
          <Route path="/players/:id" element={<PlayerDetailScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
