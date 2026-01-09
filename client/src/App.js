import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import 'leaflet/dist/leaflet.css';
import FCCDatabase from './pages/FCCDatabase';
import FCCSchedule from './pages/FCCSchedule';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import QRZLookup from './pages/QRZLookup';
import Operators from './pages/Operators';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import { initializeMobileUtils } from './utils/mobileUtils';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  // Initialize mobile utilities on app load
  useEffect(() => {
    initializeMobileUtils();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <Router>
              <div className="App">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/sessions" element={<Sessions />} />
                          <Route path="/sessions/:id" element={<SessionDetail />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/fcc" element={<FCCDatabase />} />
                          <Route path="/fcc/schedule" element={
                            <ProtectedRoute requireAdmin={true}>
                              <FCCSchedule />
                            </ProtectedRoute>
                          } />
                          <Route path="/qrz" element={<QRZLookup />} />
                          <Route path="/operators" element={<Operators />} />
                          <Route path="/users" element={
                            <ProtectedRoute requireAdmin={true}>
                              <UserManagement />
                            </ProtectedRoute>
                          } />
                          <Route path="/settings" element={
                            <ProtectedRoute requireAdmin={true}>
                              <Settings />
                            </ProtectedRoute>
                          } />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  } />
                </Routes>
                <Toaster 
                  position="top-center"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                      fontSize: '14px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      maxWidth: '90vw',
                    },
                    // Mobile-specific positioning
                    className: 'mobile-toast',
                  }}
                />
              </div>
            </Router>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;