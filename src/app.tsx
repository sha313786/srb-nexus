import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GuildSelector } from './pages/GuildSelector';
import { ModuleDashboard } from './pages/ModuleDashboard';

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Guild Selection Page */}
        <Route path="/dashboard" element={<GuildSelector />} />

        {/* Individual Guild Module Dashboard */}
        <Route path="/dashboard/:guildId" element={<ModuleDashboard />} />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;