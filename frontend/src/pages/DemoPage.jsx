import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import axios from 'axios';
import {
  AlertTriangle, ShieldCheck, Activity, TrendingUp, TrendingDown,
  Minus, RefreshCw, Database, Users, BarChart3, Zap,
  Clock, Filter, ChevronDown, Loader2, Brain, Settings
} from 'lucide-react';
import UserCard from '../Components/UserCard';

const API = 'http://localhost:8000';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card glass-panel">
      <div className="stat-icon" style={{ background: `${color}20`, color }}><Icon size={20} /></div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}// ── Setup Screen (no cache yet) ───────────────────────────────────────────────
function SetupScreen({ onBuildStart, buildProgress, availableFiles, onFileChange, selectedFile }) {
  const pct = buildProgress.total > 0
    ? Math.round((buildProgress.processed / buildProgress.total) * 100)
    : 0;

  return (
    <div className="setup-screen glass-panel">
      <Brain size={52} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
      <h2 className="setup-title">Build Prediction Cache</h2>
      <p className="setup-desc">
        Run the full MentalBERT → PCA → XGBoost pipeline on your dataset <strong>once</strong>.
        After that, the dashboard loads instantly with random samples on every refresh.
      </p>

      {buildProgress.running ? (
        <div className="build-progress">
          <div className="build-progress-bar-wrap">
            <div className="build-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="build-progress-text">
            <Loader2 size={14} className="spin-icon" />
            Processing {buildProgress.processed.toLocaleString()} / {buildProgress.total.toLocaleString()} posts ({pct}%)
          </div>
        </div>
      ) : (
        <>
          <div className="form-group" style={{ width: '100%', maxWidth: 400 }}>
            <label className="form-label">Dataset to process</label>
            <select className="form-input form-select" value={selectedFile} onChange={e => onFileChange(e.target.value)}>
              {availableFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {buildProgress.error && (
            <div className="input-error" style={{ marginTop: '0.5rem' }}>
              <AlertTriangle size={14} /> {buildProgress.error}
            </div>
          )}
          <button className="btn btn-primary" onClick={onBuildStart} id="build-cache-btn" style={{ marginTop: '1.5rem', padding: '0.85rem 2.5rem' }}>
            <Zap size={18} /> Build Cache
          </button>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ══════════════════════════════════════════════════════════════════════════════
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

// ── UTILS ──
const exportToPDF = (users) => {
  try {
    const doc = new jsPDF();
    doc.text("MindWatch - Mental Health Risk Analysis Report (Demo Data)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    
    const tableData = users.map(u => [
      u.username,
      u.risk_level,
      u.current_label,
      u.trend,
      u.post_count,
      `${Math.round(u.avg_confidence * 100)}%`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Username', 'Risk Level', 'Severity', 'Trend', 'Posts', 'Confidence']],
      body: tableData,
      headStyles: { fillColor: [29, 158, 117] }, // #1D9E75
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 244, 240] }
    });

    doc.save(`MindWatch_Demo_Report_${new Date().getTime()}.pdf`);
  } catch (err) {
    console.error("PDF Export failed:", err);
    alert("Failed to generate PDF. Please try Excel or check console.");
  }
};

const exportToExcel = (users) => {
  try {
    const data = users.map(u => ({
      Username: u.username,
      Risk_Level: u.risk_level,
      Severity: u.current_label,
      Trend: u.trend,
      Post_Count: u.post_count,
      Avg_Confidence: `${Math.round(u.avg_confidence * 100)}%`
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `MindWatch_Demo_Data_${new Date().getTime()}.xlsx`);
  } catch (err) {
    console.error("Excel Export failed:", err);
    alert("Failed to generate Excel file.");
  }
};

const DemoPage = () => {
  const { analyzedData } = useData();
  const navigate = useNavigate();

  // Live dataset sample (from cache)
  const [sample, setSample]           = useState(null);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [riskFilter, setRiskFilter]   = useState('All');
  const [sampleSize, setSampleSize]   = useState(20);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedFile, setSelectedFile]     = useState('final_dataset_5to7_posts_12000.csv');
  const [pollTimer, setPollTimer]     = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Determine which data source to show
  const activeData = sample;
  const isLiveCache = true;

  // ── Fetch cache status ───────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/cache/status`);
      setCacheStatus(data);
      return data;
    } catch { return null; }
  }, []);

  // ── Fetch random sample ──────────────────────────────────────────────────
  const fetchSample = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingData(true);
    try {
      const params = { n: sampleSize };
      if (riskFilter !== 'All') params.risk = riskFilter;
      const { data } = await axios.get(`${API}/dashboard/sample`, { params });
      setSample(data);
    } catch (e) {
      console.error('Sample fetch failed', e);
    } finally {
      setRefreshing(false);
      setLoadingData(false);
    }
  }, [sampleSize, riskFilter]);

  // ── Build cache ──────────────────────────────────────────────────────────
  const handleBuildStart = async () => {
    try {
      await axios.post(`${API}/cache/build`, { filename: selectedFile });
      // Start polling
      const timer = setInterval(async () => {
        const status = await fetchStatus();
        if (status?.ready) {
          clearInterval(timer);
          await fetchSample();
        }
      }, 4000);
      setPollTimer(timer);
      await fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const status = await fetchStatus();
      // Load available datasets
      try {
        const { data } = await axios.get(`${API}/datasets/list`);
        setAvailableFiles(data.files || []);
      } catch {}
      // If cache is ready and no upload data, load sample
      if (status?.ready && !analyzedData) {
        await fetchSample();
      }
    };
    init();
    return () => { if (pollTimer) clearInterval(pollTimer); };
  }, []);

  // Re-fetch sample when filter/size changes (if cache is ready)
  useEffect(() => {
    if (cacheStatus?.ready && !analyzedData) {
      fetchSample();
    }
  }, [riskFilter, sampleSize]);

  // ── Compute stats ────────────────────────────────────────────────────────
  const users = activeData?.users || [];
  const highCount   = users.filter(u => u.risk_level === 'High').length;
  const medCount    = users.filter(u => u.risk_level === 'Medium').length;
  const lowCount    = users.filter(u => u.risk_level === 'Low').length;
  const avgConf     = users.length
    ? Math.round((users.reduce((s, u) => s + (u.avg_confidence || 0.5), 0) / users.length) * 100)
    : 0;
  const totalInCache = cacheStatus?.total_users || activeData?.total_in_cache || 0;
  const totalPosts   = cacheStatus?.total_posts || activeData?.total_posts || 0;

  // ── Build progress polling state ─────────────────────────────────────────
  const buildRunning  = cacheStatus?.build_progress?.running;
  const buildProgress = cacheStatus?.build_progress || {};

  // Poll status while building
  useEffect(() => {
    if (!buildRunning) return;
    const t = setInterval(async () => {
      const s = await fetchStatus();
      if (s?.ready && !s?.build_progress?.running) {
        clearInterval(t);
        fetchSample();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [buildRunning]);

  // ── If no cache and no uploaded data → show setup screen ─────────────────
  if (!cacheStatus?.ready && !analyzedData) {
    return (
      <div className="dashboard-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">MindWatch Dashboard</h1>
          <p className="page-subtitle">Mental health deterioration detection at scale</p>
        </div>
        <SetupScreen
          onBuildStart={handleBuildStart}
          buildProgress={{ ...buildProgress, running: buildRunning }}
          availableFiles={availableFiles}
          onFileChange={setSelectedFile}
          selectedFile={selectedFile}
        />
        <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
          Or{' '}
          <span
            style={{ color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/upload')}
          >
            upload a CSV
          </span>{' '}to analyze immediately.
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'High', value: highCount, color: '#ef4444' },
    { name: 'Medium', value: medCount, color: '#eab308' },
    { name: 'Low', value: lowCount, color: '#10b981' },
  ];

  const handleExport = async (format) => {
    setShowExportMenu(false);
    setLoadingData(true);
    try {
      const { data } = await axios.get(`${API}/dashboard/all`);
      if (format === 'pdf') exportToPDF(data.users);
      else exportToExcel(data.users);
    } catch (e) {
      console.error("Export fetch failed", e);
      alert("Could not fetch full data for report.");
    } finally {
      setLoadingData(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>MindWatch Dashboard</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {isLiveCache
              ? `Live sample`
              : `Analyzed dataset · ${users.length} users`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', alignItems: 'center' }}>
          <div className="export-dropdown-wrap">
            <button 
              className="btn btn-primary" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={loadingData}
              style={{ padding: '0.65rem 1.25rem' }}
            >
              <Download size={18} /> Download Report
            </button>
            
            {showExportMenu && (
              <div className="glass-panel export-menu" style={{ 
                position: 'absolute', 
                top: '110%', 
                right: 0, 
                zIndex: 100, 
                padding: '0.5rem',
                minWidth: '160px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <button className="export-menu-item" onClick={() => handleExport('pdf')}>
                  📄 Export Whole Data (PDF)
                </button>
                <button className="export-menu-item" onClick={() => handleExport('excel')}>
                  📊 Export Whole Data (Excel)
                </button>
              </div>
            )}
          </div>
          {isLiveCache && (
            <button
              className={`btn btn-secondary refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchSample(true)}
              disabled={refreshing}
              id="refresh-sample-btn"
            >
              <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
              {refreshing ? 'Refreshing…' : 'New Sample'}
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-row">
        <StatCard icon={AlertTriangle} label="High Risk"     value={highCount}                      color="#ef4444" sub="Alert" />
        <StatCard icon={Activity} label="Medium Risk"        value={medCount}                       color="#eab308" sub="Monitor" />
        <StatCard icon={ShieldCheck} label="Stable"          value={lowCount}                       color="#10b981" sub="Low risk" />
        <StatCard icon={Brain}    label="Avg Confidence"     value={`${avgConf}%`}                  color="#8b5cf6" sub="Model certainty" />
      </div>

      {/* Chart Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', height: '300px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Risk Distribution (Sample)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <ReTooltip 
              cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar glass-panel">
        <div className="filter-group">
          <Filter size={15} style={{ color: 'var(--text-secondary)' }} />
          <span className="filter-label">Filter:</span>
          {['All', 'High', 'Medium', 'Low'].map(r => (
            <button
              key={r}
              className={`filter-chip ${riskFilter === r ? 'active' : ''}`}
              style={riskFilter === r ? {
                background: r === 'All' ? 'var(--accent-primary)' :
                            r === 'High' ? '#ef4444' : r === 'Medium' ? '#eab308' : '#10b981',
                color: 'white'
              } : {}}
              onClick={() => setRiskFilter(r)}
              id={`filter-${r.toLowerCase()}`}
            >
              {r}
            </button>
          ))}
        </div>
        {isLiveCache && (
          <div className="filter-group">
            <span className="filter-label">Show:</span>
            <select
              className="form-input form-select"
              style={{ padding: '0.35rem 2rem 0.35rem 0.75rem', fontSize: '0.875rem', width: 'auto' }}
              value={sampleSize}
              onChange={e => setSampleSize(Number(e.target.value))}
              id="sample-size-select"
            >
              {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n} users</option>)}
            </select>
          </div>
        )}
        <div className="filter-right">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Showing {users.length} users
          </span>
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingData && (
        <div className="dash-loading">
          <Loader2 size={28} className="spin-icon" style={{ color: 'var(--accent-primary)' }} />
          <span>Loading sample…</span>
        </div>
      )}

      {/* User Grid */}
      {!loadingData && (
        <div className="user-grid-v2">
          {users.map((user, i) => (
            <UserCard
              key={user.username}
              user={user}
              onClick={() => navigate(`/user/${user.username}`)}
            />
          ))}
          {users.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              No users match the selected filter.
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="dash-footer">
        {isLiveCache && cacheStatus?.built_at && (
          <span>
            <Clock size={13} /> Cache built: {new Date(cacheStatus.built_at).toLocaleString()}
          </span>
        )}
        {analyzedData?.analysis_time_seconds && (
          <span>
            <Zap size={13} /> Analyzed in {analyzedData.analysis_time_seconds}s
          </span>
        )}
        {isLiveCache && (
          <span
            style={{ color: 'var(--accent-primary)', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            ↑ Upload your own dataset
          </span>
        )}
      </div>
    </div>
  );
};

export default DemoPage;
