import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Students from './pages/Students';
import Groups from './pages/Groups';
import Attendance from './pages/Attendance';
import StudentPayments from './pages/StudentPayments';
import TeacherPayments from './pages/TeacherPayments';
import Subjects from './pages/Subjects';
import Reports from './pages/Reports';
import Tags from './pages/Tags';
import Invoices from './pages/Invoices';
import Users from './pages/Users';
import TeacherPortal from './pages/TeacherPortal';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-full">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'admin') return <Navigate to="/teacher" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-full">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RedirectIfLoggedIn({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-full">Loading...</div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/' : '/teacher'} replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <RedirectIfLoggedIn><Login /></RedirectIfLoggedIn>
  },
  {
    path: '/teacher',
    element: <RequireAuth><TeacherPortal /></RequireAuth>
  },
  {
    path: '/',
    element: <RequireAdmin><Layout /></RequireAdmin>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'teachers', element: <Teachers /> },
      { path: 'students', element: <Students /> },
      { path: 'groups', element: <Groups /> },
      { path: 'subjects', element: <Subjects /> },
      { path: 'attendance', element: <Attendance /> },
      { path: 'payments/students', element: <StudentPayments /> },
      { path: 'payments/teachers', element: <TeacherPayments /> },
      { path: 'reports', element: <Reports /> },
      { path: 'tags', element: <Tags /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'users', element: <Users /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
