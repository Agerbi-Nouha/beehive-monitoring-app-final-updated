import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import FloatingChatbot from './components/FloatingChatbot.jsx';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Hives from './pages/Hives.jsx';
import HiveDetails from './pages/HiveDetails.jsx';
import History from './pages/History.jsx';
import Alerts from './pages/Alerts.jsx';
import Sensors from './pages/Sensors.jsx';
import Map from './pages/Map.jsx';
import ExportPage from './pages/Export.jsx';
import Settings from './pages/Settings.jsx';
import AdminDevices from './pages/AdminDevices.jsx';

function AppLayout() {
  return (
    <div className="h-full flex honeycomb-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hives" element={<Hives />} />
            <Route path="/hives/:hiveId" element={<HiveDetails />} />
            <Route path="/history" element={<History />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/map" element={<Map />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/admin/devices"
              element={
                <AdminRoute>
                  <AdminDevices />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mounted once globally */}
      <FloatingChatbot />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
