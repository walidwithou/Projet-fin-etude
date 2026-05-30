import { useState, useEffect } from 'react';
import Registration from './pages/Registration';
import Login from './pages/Login';
import About from './pages/About';
import Patient from './pages/Patient';
import Therapist from './pages/Therapist';
import Settings from './pages/Settings';
import Panel from './pages/Panel';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('REGISTRATION');
  const [initialMode, setInitialMode] = useState(null);
  const [initialTab, setInitialTab] = useState('account');
  const [sessionData, setSessionData] = useState({
    user: null,
    userRole: null, // 'PATIENT' or 'THERAPIST'
    selectedTherapist: null
  });

  // Dark Mode global initialization
  useEffect(() => {
    const root = window.document.documentElement;
    const initialTheme = localStorage.getItem('theme') || 'system';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = (theme) => {
      root.classList.remove('light', 'dark');
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    };

    applyTheme(initialTheme);
    
    if (initialTheme === 'system') {
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const handleNavigate = (page, data = {}) => {
    if (data.therapist) {
      setSessionData(prev => ({ ...prev, selectedTherapist: data.therapist }));
    }
    if (data.role) {
      setSessionData(prev => ({ ...prev, userRole: data.role }));
    }
    setInitialMode(data.mode || null);
    setInitialTab(data.tab || 'account');
    setCurrentPage(page);
  };

  if (currentPage === 'SETTINGS') {
    return (
      <Settings 
        onNavigateToPage={handleNavigate} 
        initialTab={initialTab}
        userRole={sessionData.userRole}
      />
    );
  }

  if (currentPage === 'PATIENT' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'PATIENT')) {
    return (
      <Patient 
        onNavigateToPage={handleNavigate} 
        currentTherapist={sessionData.selectedTherapist}
      />
    );
  }

  if (currentPage === 'THERAPIST' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'THERAPIST')) {
    return (
      <Therapist 
        onNavigateToPage={handleNavigate} 
      />
    );
  }

  if (currentPage === 'ADMIN' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'ADMIN')) {
    return (
      <Panel 
        onNavigateToPage={handleNavigate} 
      />
    );
  }

  if (currentPage === 'LOGIN') {
    return (
      <Login 
        onBackToRegistration={() => handleNavigate('REGISTRATION')} 
        onNavigateToPage={handleNavigate}
      />
    );
  }

  if (currentPage === 'ABOUT') {
    return <About onNavigateToPage={handleNavigate} />;
  }

  return (
    <Registration 
      onNavigateToLogin={() => handleNavigate('LOGIN')} 
      onNavigateToPage={handleNavigate} 
      initialMode={initialMode}
    />
  );
}

export default function App() {
  return (
    <AppContent />
  );
}
