import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import axios from 'axios';
import {
  AlertTriangle, ShieldCheck, Activity, TrendingUp, TrendingDown,
  Minus, Brain, Loader2, UploadCloud, FileText, Database,
  Cpu, PenLine, Plus, Trash2, CheckCircle2, Search, AlertCircle, Users, Clock
} from 'lucide-react';
import UserCard from '../Components/UserCard';
import API from '../api';


function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card glass-panel">
      <div className="stat-icon" style={{ background: `${color}20`, color }}><Icon size={20} /></div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── INPUT OPTIONS COMPONENTS ──
const ErrorBox = ({ msg }) => msg ? <div className="input-error"><AlertCircle size={15} />{msg}</div> : null;
const AnalyzeBtn = ({ onClick, disabled, loading, label = 'Analyze' }) => (
  <button className="btn btn-primary analyze-btn" onClick={onClick} disabled={disabled || loading}>
    {loading && <Loader2 size={18} className="spin-icon" />} {loading ? 'Analyzing…' : label}
  </button>
);

const CsvTab = ({ onResult, loading, setLoading }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const accept = (f) => { 
    if (f?.name?.toLowerCase().match(/\.(csv|xlsx|xls)$/)) { 
      setFile(f); 
      setError(null); 
    } else {
      setError('Only .csv, .xlsx, or .xls files are accepted.'); 
    }
  };
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }, []);
  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const fd = new FormData(); fd.append('file', file);
    try { const { data } = await axios.post(`${API}/analyze/csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); onResult(data); } catch (e) { setError('Upload failed. Check your file format.'); } finally { setLoading(false); }
  };
  return (
    <div className="tab-body">
      <p className="tab-desc">Upload a CSV or Excel file containing username, post_text, timestamp columns.</p>
      <div className={`drop-zone ${file ? 'active' : ''} ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => document.getElementById('csv-file-input').click()}>
        <input id="csv-file-input" type="file" accept=".csv, .xlsx, .xls" onChange={(e) => accept(e.target.files[0])} style={{display:'none'}} />
        <UploadCloud className="upload-icon" />
        {file ? <div className="file-selected"><CheckCircle2 size={18} style={{ color: 'var(--color-normal)' }} /> {file.name}</div> : <><div className="drop-title">Drop CSV or Excel here or click to browse</div><div className="drop-hint">Max 50 MB</div></>}
      </div>
      <ErrorBox msg={error} />
      <AnalyzeBtn onClick={handleAnalyze} disabled={!file} loading={loading} label="Analyze File" />
    </div>
  );
};

const HuggingFaceTab = ({ onResult, loading, setLoading }) => {
  const [subreddit, setSubreddit] = useState('');
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState(null);
  const categories = ['depression', 'adhd', 'ptsd', 'ocd', 'aspergers'];

  const handleAnalyze = async () => {
    setLoading(true); setError(null);
    try { const { data } = await axios.post(`${API}/analyze/dataset`, { subreddit: subreddit.trim() || null, limit: Number(limit) }); onResult(data); } catch (e) { setError('Streaming failed.'); } finally { setLoading(false); }
  };

  return (
    <div className="tab-body">
      <div className="hf-badge"><Cpu size={14} /> solomonk/reddit_mental_health_posts</div>
      <p className="tab-desc">Streams the public HuggingFace dataset. Select a category below or type a keyword.</p>
      
      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
        <label className="form-label">Available Categories</label>
        <div className="category-suggestions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {categories.map(cat => (
            <button 
              key={cat} 
              className={`cat-suggest-btn ${subreddit === cat ? 'active' : ''}`}
              onClick={() => setSubreddit(cat)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid var(--border-glass)',
                background: subreddit === cat ? 'var(--accent-primary)' : 'var(--bg-glass)',
                color: subreddit === cat ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}><label className="form-label">Search Keyword</label><input className="form-input" placeholder="e.g. depression" value={subreddit} onChange={(e) => setSubreddit(e.target.value)} /></div>
        <div className="form-group" style={{ flex: 1 }}><label className="form-label">Post limit</label><select className="form-input form-select" value={limit} onChange={(e) => setLimit(e.target.value)}>{[50, 100, 200, 500].map(n => <option key={n} value={n}>{n} posts</option>)}</select></div>
      </div>
      <ErrorBox msg={error} />
      <AnalyzeBtn onClick={handleAnalyze} disabled={false} loading={loading} label="Stream & Analyze" />
    </div>
  );
};

const RedditTab = ({ onResult, loading, setLoading }) => {
  const [subreddit, setSubreddit] = useState('');
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState(null);
  const handleAnalyze = async () => {
    if (!subreddit.trim()) return;
    setLoading(true); setError(null);
    try { 
      const { data } = await axios.post(`${API}/analyze/dataset`, { 
        subreddit: subreddit.trim(), 
        limit: Number(limit) 
      }); 
      onResult(data); 
    } catch (e) { 
      setError('Failed to load demonstration data.'); 
    } finally { 
      setLoading(false); 
    }
  };
  return (
    <div className="tab-body">
      <div className="reddit-status-banner status-amber" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <AlertTriangle size={18} />
        <span>Live Reddit API integration is under development. Currently, demonstration data is used to showcase the analytics pipeline.</span>
      </div>
      <p className="tab-desc">Fetch posts from any public subreddit using demonstration data.</p>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}><label className="form-label">Subreddit name</label><input className="form-input" placeholder="depression" value={subreddit} onChange={(e) => setSubreddit(e.target.value)} /></div>
        <div className="form-group" style={{ flex: 1 }}><label className="form-label">Post limit</label><select className="form-input form-select" value={limit} onChange={(e) => setLimit(e.target.value)}>{[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} posts</option>)}</select></div>
      </div>
      <ErrorBox msg={error} />
      <AnalyzeBtn onClick={handleAnalyze} disabled={!subreddit.trim()} loading={loading} label="Fetch & Analyze" />
    </div>
  );
};

const ManualTab = ({ onResult, loading, setLoading }) => {
  const getLocalISO = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return (new Date(now - tzOffset)).toISOString().slice(0, 16);
  };

  const emptyManualPost = () => ({ 
    id: Math.random().toString(36).substr(2, 9), 
    post_text: '', 
    timestamp: getLocalISO()
  });

  const emptyManualUser = () => ({ 
    id: Math.random().toString(36).substr(2, 9), 
    username: '', 
    posts: [emptyManualPost()] 
  });

  const [users, setUsers] = useState([emptyManualUser()]);
  const [error, setError] = useState(null);

  const addUser = () => setUsers(prev => [...prev, emptyManualUser()]);
  
  const delUser = (userId) => {
    if (users.length > 1) {
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  const updateUsername = (userId, name) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, username: name } : u));
  };

  const addPost = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, posts: [...u.posts, emptyManualPost()] } : u));
  };

  const delPost = (userId, postId) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId && u.posts.length > 1) {
        return { ...u, posts: u.posts.filter(p => p.id !== postId) };
      }
      return u;
    }));
  };

  const updatePost = (userId, postId, field, val) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          posts: u.posts.map(p => p.id === postId ? { ...p, [field]: val } : p)
        };
      }
      return u;
    }));
  };

  const handleAnalyze = async () => {
    // Flatten users -> posts
    const flattened = [];
    users.forEach(u => {
      if (u.username.trim()) {
        u.posts.forEach(p => {
          if (p.post_text.trim()) {
            flattened.push({
              username: u.username.trim(),
              post_text: p.post_text.trim(),
              timestamp: p.timestamp
            });
          }
        });
      }
    });

    if (!flattened.length) {
      setError('Add at least one user with a post.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/analyze/manual`, { posts: flattened });
      onResult(data);
    } catch (e) {
      setError('Analysis failed. Check your input and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-body">
      <p className="tab-desc">Add users and their posts manually. You can add multiple posts per user.</p>
      
      <div className="manual-users-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {users.map((user) => (
          <div key={user.id} className="manual-user-section glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-glass)', borderRadius: '1rem' }}>
            <div className="user-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Users size={18} style={{ color: 'var(--accent-primary)' }} />
                  <input 
                    className="form-input" 
                    placeholder="Enter Username" 
                    value={user.username} 
                    onChange={(e) => updateUsername(user.id, e.target.value)}
                    style={{ fontWeight: 'bold', fontSize: '1rem' }}
                  />
                </div>
              </div>
              {users.length > 1 && (
                <button className="icon-btn danger" onClick={() => delUser(user.id)} title="Delete User">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="posts-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-glass)' }}>
              {user.posts.map((post, pIdx) => (
                <div key={post.id} className="post-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <textarea 
                      className="form-input form-textarea" 
                      placeholder={`Post content #${pIdx + 1}`} 
                      value={post.post_text} 
                      onChange={(e) => updatePost(user.id, post.id, 'post_text', e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div style={{ width: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <Clock size={12} /> Timestamp
                    </div>
                    <input 
                      type="datetime-local"
                      className="form-input"
                      style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                      value={post.timestamp}
                      max={getLocalISO()}
                      onChange={(e) => updatePost(user.id, post.id, 'timestamp', e.target.value)}
                    />
                  </div>
                  {user.posts.length > 1 && (
                    <button 
                      className="icon-btn" 
                      onClick={() => delPost(user.id, post.id)} 
                      style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}
                      title="Remove Post"
                    >
                      <Minus size={16} />
                    </button>
                  )}
                </div>
              ))}
              
              <button 
                className="btn btn-secondary" 
                onClick={() => addPost(user.id)}
                style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', fontSize: '0.85rem', marginTop: '0.5rem' }}
              >
                <Plus size={14} /> Add Post to {user.username || 'User'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-glass)' }}>
        <button className="btn btn-secondary" onClick={addUser}>
          <Users size={16} /> Add New User
        </button>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ErrorBox msg={error} />
          <AnalyzeBtn onClick={handleAnalyze} disabled={loading} loading={loading} label="Analyze All Manual Data" />
        </div>
      </div>
    </div>
  );
};

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
    doc.text("MindWatch - Mental Health Risk Analysis Report", 14, 15);
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

    doc.save(`MindWatch_Report_${new Date().getTime()}.pdf`);
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
    XLSX.writeFile(wb, `MindWatch_Data_${new Date().getTime()}.xlsx`);
  } catch (err) {
    console.error("Excel Export failed:", err);
    alert("Failed to generate Excel file.");
  }
};

// ── MAIN DASHBOARD COMPONENT ──
const Dashboard = () => {
  const { analyzedData, setAnalyzedData, loading, setLoading } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('csv');
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (!analyzedData) {
    const TABS = [
      { id: 'csv', label: 'Dataset Upload', icon: FileText, color: '#3b82f6' },
      { id: 'huggingface', label: 'HuggingFace', icon: Cpu, color: '#ff9d00' },
      { id: 'reddit', label: 'Reddit API', icon: Database, color: '#ff4500' },
      { id: 'manual', label: 'Manual Entry', icon: PenLine, color: '#10b981' },
    ];
    const sharedProps = { onResult: setAnalyzedData, loading, setLoading };
    
    return (
      <div className="upload-page-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">MindWatch Dashboard</h1>
          <p className="page-subtitle">Select an input method to begin analysis.</p>
        </div>
        <div className="input-card glass-panel">
          <div className="tab-bar">
            {TABS.map(({ id, label, icon: Icon, color }) => (
              <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} style={{ '--tab-color': color }} onClick={() => setActiveTab(id)}>
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {activeTab === 'csv' && <CsvTab {...sharedProps} />}
            {activeTab === 'huggingface' && <HuggingFaceTab {...sharedProps} />}
            {activeTab === 'reddit' && <RedditTab {...sharedProps} />}
            {activeTab === 'manual' && <ManualTab {...sharedProps} />}
          </div>
        </div>
      </div>
    );
  }

  const users = analyzedData.users || [];
  const highCount = users.filter(u => u.risk_level === 'High').length;
  const medCount = users.filter(u => u.risk_level === 'Medium').length;
  const lowCount = users.filter(u => u.risk_level === 'Low').length;
  const avgConf = users.length ? Math.round((users.reduce((s, u) => s + (u.avg_confidence || 0.5), 0) / users.length) * 100) : 0;

  const chartData = [
    { name: 'High', value: highCount, color: '#ef4444' },
    { name: 'Medium', value: medCount, color: '#eab308' },
    { name: 'Low', value: lowCount, color: '#10b981' },
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="dash-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Analyzed Dashboard</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Analyzed dataset · {users.length} users</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
          <div className="export-dropdown-wrap">
            <button 
              className="btn btn-primary" 
              onClick={() => setShowExportMenu(!showExportMenu)}
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
                <button className="export-menu-item" onClick={() => { exportToPDF(users); setShowExportMenu(false); }}>
                  📄 Export as PDF
                </button>
                <button className="export-menu-item" onClick={() => { exportToExcel(users); setShowExportMenu(false); }}>
                  📊 Export as Excel
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => setAnalyzedData(null)}>Clear Data</button>
        </div>
      </div>

      <div className="stats-row">
        <StatCard icon={AlertTriangle} label="High Risk" value={highCount} color="#ef4444" sub="Alert" />
        <StatCard icon={Activity} label="Medium Risk" value={medCount} color="#eab308" sub="Monitor" />
        <StatCard icon={ShieldCheck} label="Stable" value={lowCount} color="#10b981" sub="Low risk" />
        <StatCard icon={Brain} label="Avg Confidence" value={`${avgConf}%`} color="#8b5cf6" sub="Model certainty" />
      </div>

      {/* Chart Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', height: '300px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Risk Distribution</h3>
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

      <div className="user-grid-v2">
        {users.map(user => <UserCard key={user.username} user={user} onClick={() => navigate(`/user/${user.username}`)} />)}
      </div>
    </div>
  );
};

export default Dashboard;
