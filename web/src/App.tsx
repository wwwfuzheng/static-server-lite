import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { ManagerPage } from './pages/Manager';
import { useAuth } from './store/auth';

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <ManagerPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
