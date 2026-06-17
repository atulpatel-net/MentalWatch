import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, AlertTriangle, ShieldCheck, Clock, Calendar, Loader2 } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import axios from 'axios';
import API from '../api';


const UserPage = () => {
  const { username } = useParams();
  const { analyzedData } = useData();
  const navigate = useNavigate();

  const [cachedUser, setCachedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Try to find the user in local session data first
  const localUser = useMemo(() => {
    if (!analyzedData?.users) return null;
    return analyzedData.users.find(u => u.username === username);
  }, [analyzedData, username]);

  // If not in local data, fetch from backend cache
  useEffect(() => {
    if (localUser) return;
    
    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/cache/user/${username}`);
        setCachedUser(data);
      } catch (err) {
        setError(err.response?.data?.detail || "User not found");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [localUser, username]);

  const user = localUser || cachedUser;

  if (loading) {
    return (
      <div className="dash-loading" style={{ minHeight: '50vh' }}>
        <Loader2 size={32} className="spin-icon" style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontSize: '1.2rem' }}>Loading user data...</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="empty-state">
        <AlertTriangle size={48} style={{ color: 'var(--color-critical)', opacity: 0.8, marginBottom: '1rem' }} />
        <h2>{error || "User Not Found"}</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ margin: '1.5rem auto 0' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const chartData = user.posts.map((post, idx) => {
    const date = new Date(post.timestamp);
    return {
      index: idx + 1,
      date: date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      severity: post.severity,
      rawDate: date
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const severityMap = { 0: 'Normal', 1: 'Distressed', 2: 'Critical' };
      const colors = { 0: 'var(--color-normal)', 1: 'var(--color-distressed)', 2: 'var(--color-critical)' };
      
      return (
        <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-glass)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{data.date}</p>
          <p style={{ fontWeight: '600', color: colors[data.severity] }}>
            Severity: {severityMap[data.severity]} ({data.severity})
          </p>
        </div>
      );
    }
    return null;
  };

  const getSeverityBadge = (severity) => {
    switch(severity) {
      case 2: return <span className="badge badge-critical"><AlertTriangle size={14}/> Critical</span>;
      case 1: return <span className="badge badge-distressed"><ShieldCheck size={14}/> Distressed</span>;
      default: return <span className="badge badge-normal"><ShieldCheck size={14}/> Normal</span>;
    }
  };

  const getConfidencePill = (conf = 0.5) => {
    const pct   = Math.round(conf * 100);
    const color = conf >= 0.8 ? '#10b981' : conf >= 0.6 ? '#eab308' : '#ef4444';
    return (
      <span style={{
        background: `${color}18`, color, border: `1px solid ${color}35`,
        borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600
      }}>
        {pct}% conf
      </span>
    );
  };

  return (
    <div>
      <button 
        className="btn btn-secondary" 
        onClick={() => navigate('/')}
        style={{ marginBottom: '2rem', display: 'inline-flex', padding: '0.5rem 1rem' }}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="user-details-header glass-panel">
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{user.username}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} /> {user.post_count} Posts Analyzed
            </span>
            {user.first_warning_date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-distressed)' }} /> 
                First Warning: {new Date(user.first_warning_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current Status</div>
          <div className={`badge badge-${user.current_label.toLowerCase()}`} style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}>
            {user.current_label === 'Critical' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            {user.status}
          </div>
        </div>
      </div>

      <div className="glass-panel chart-container">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Deterioration Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis 
              dataKey="index" 
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 2]} 
              ticks={[0, 1, 2]}
              tickFormatter={(val) => {
                if (val === 0) return 'Normal';
                if (val === 1) return 'Distressed';
                if (val === 2) return 'Critical';
                return '';
              }}
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={2} stroke="rgba(239, 68, 68, 0.2)" strokeDasharray="3 3" />
            <ReferenceLine y={1} stroke="rgba(234, 179, 8, 0.2)" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="severity" 
              stroke="var(--accent-primary)" 
              strokeWidth={3}
              dot={{ r: 4, fill: 'var(--bg-dark)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'var(--accent-primary)', stroke: 'white' }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Post History</h3>
      
      <div className="posts-list">
        {user.posts.map((post, idx) => (
          <div key={idx} className={`post-card glass-panel severity-${post.severity}`}>
            <div className="post-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} />
                {new Date(post.timestamp).toLocaleString()}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getSeverityBadge(post.severity)}
                {getConfidencePill(post.confidence)}
              </span>
            </div>
            <div className="post-text">
              {post.post_text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserPage;
