import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, Upload, Database } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import DemoPage from './pages/DemoPage';
import UploadPage from './pages/UploadPage';
import UserPage from './pages/UserPage';
import './index.css';

const Navbar = () => {
  const location = useLocation();
  
  return (
    <nav className="navbar glass-panel">
      <Link to="/" className="logo">
        <Brain size={28} />
        MindWatch
      </Link>
      <div className="nav-links">
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <Link 
          to="/upload" 
          className={`nav-link ${location.pathname === '/upload' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Upload size={18} />
          Upload Dataset
        </Link>
        <Link 
          to="/demo" 
          className={`nav-link ${location.pathname === '/demo' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Database size={18} />
          Demo Data
        </Link>
      </div>
    </nav>
  );
};

import { DataProvider } from './context/DataContext';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/user/:username" element={<UserPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
