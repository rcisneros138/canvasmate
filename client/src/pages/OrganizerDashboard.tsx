import { Link } from 'react-router-dom';

export default function OrganizerDashboard() {
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">CanvasMate</h1>
      <Link
        to="/session/new"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
      >
        New Canvass Session
      </Link>
    </div>
  );
}
