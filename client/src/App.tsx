import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateSession from './pages/CreateSession';
import SessionPage from './pages/SessionPage';
import JoinPage from './pages/JoinPage';
import SignIn from './pages/SignIn';
import { AuthProvider } from './hooks/useAuth';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/session/new" element={<CreateSession />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/join/:sessionId" element={<JoinPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
