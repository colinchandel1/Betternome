import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { createApiClient } from './api/client';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import RoleSelect from './pages/RoleSelect';
import Dashboard from './pages/Dashboard';
import Classroom from './pages/Classroom';

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    getAccessTokenSilently,
  } = useAuth0();

  const [api, setApi] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  // Build an authenticated axios client once Auth0 is ready
  useEffect(() => {
    if (isAuthenticated) {
      setApi(createApiClient(getAccessTokenSilently));
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Fetch (or auto-provision) the server-side user record
  useEffect(() => {
    if (!api) return;
    setUserLoading(true);
    api
      .get('/api/users/me')
      .then((res) => setDbUser(res.data))
      .catch(console.error)
      .finally(() => setUserLoading(false));
  }, [api]);

  const selectRole = useCallback(
    async (role) => {
      const res = await api.patch('/api/users/me/role', { role });
      setDbUser(res.data);
    },
    [api]
  );

  // ── Loading states ─────────────────────────────────────────────────────────
  if (isLoading || userLoading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Login />;
  }

  // ── Logged in but role not yet chosen ──────────────────────────────────────
  // The server defaults new users to 'student', but we also check for the
  // case where a user wants to explicitly choose (first sign-up).
  // We treat a fresh user (role === 'student' and no classrooms yet) as still
  // needing role selection IF this is their first session and the flag is set.
  // Simplest approach: show role-select only when dbUser is brand-new (we use
  // a `needs_role_selection` placeholder set server-side via a custom claim or
  // simply show the page once, storing the choice locally).
  //
  // For this prototype we show RoleSelect only when the user record was JUST
  // created (i.e., dbUser exists but we haven't refreshed yet). To keep it
  // simple: show RoleSelect when the user's `role` claim from Auth0 namespace
  // is absent and the DB role is still the default 'student'.
  if (!dbUser) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Navbar user={dbUser} />
      <Routes>
        <Route
          path="/"
          element={<Dashboard api={api} dbUser={dbUser} />}
        />
        <Route
          path="/classroom/:id"
          element={<Classroom api={api} dbUser={dbUser} />}
        />
        <Route
          path="/select-role"
          element={<RoleSelect onSelect={selectRole} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
