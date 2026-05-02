import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateSession from './pages/CreateSession';
import SessionPage from './pages/SessionPage';
import JoinPage from './pages/JoinPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrganizerDashboard />} />
        <Route path="/session/new" element={<CreateSession />} />
        <Route path="/session/:id" element={<SessionPage />} />
        <Route path="/join/:sessionId" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  );
}
