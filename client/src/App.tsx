import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateSession from './pages/CreateSession';
import CheckIn from './pages/CheckIn';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrganizerDashboard />} />
        <Route path="/session/new" element={<CreateSession />} />
        <Route path="/session/:id" element={<div>AssignmentBoard (loaded with session data)</div>} />
        <Route path="/join/:sessionId" element={<CheckIn sessionId="" />} />
      </Routes>
    </BrowserRouter>
  );
}
