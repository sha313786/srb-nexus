import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GuildSelector } from './pages/GuildSelector';
import { ModuleDashboard } from './pages/ModuleDashboard'; // 1. Import ModuleDashboard

export const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/servers" element={<GuildSelector />} />
        
        {/* 2. Update the path element to point to ModuleDashboard */}
        <Route path="/dashboard/:guildId" element={<ModuleDashboard />} />
        
        <Route path="*" element={<Navigate to="/servers" replace />} />
      </Routes>
    </Router>
  );
};

export default App;