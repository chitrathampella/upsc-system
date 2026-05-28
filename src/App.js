import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';

function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // This listens for the real Firebase login state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) return (
    <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system animate-pulse">
      INITIALIZING CONNECTION...
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-black text-white">
        <Routes>
          <Route path="/" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/onboarding" element={user ? <Onboarding user={user} setUser={setUser} /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <Settings user={user} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;