import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SEVERITY_COLOR = { 0: '#2e7d52', 1: '#c17f24', 2: '#c0392b' }; // new muted colors
const SEVERITY_LABEL = { 0: 'Normal', 1: 'Distressed', 2: 'Critical' };

const getRiskStyle = (risk) => ({
  High:   { accent: '#c0392b', bg: '#fdf1f0', label: 'High Risk'   },
  Medium: { accent: '#c17f24', bg: '#fef7ed', label: 'Monitor'     },
  Low:    { accent: '#2e7d52', bg: '#edf4f0', label: 'Stable'      },
}[risk] || { accent: '#1D9E75', bg: '#f0f9f6', label: risk });

function Sparkline({ scores = [] }) {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  
  const W = 120, H = 24, pad = 2;
  const validScores = scores.filter(s => typeof s === 'number');
  if (validScores.length === 0) return null;

  const step = (W - pad * 2) / Math.max(validScores.length - 1, 1);
  const points = validScores.map((s, i) => {
    const x = pad + i * step;
    const y = H - pad - ((s / 2) * (H - pad * 2));
    return `${x},${y}`;
  });
  
  const last = validScores[validScores.length - 1];
  const strokeColor = SEVERITY_COLOR[last] || '#1D9E75';

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {validScores.length > 1 && (
        <polyline 
          points={points.join(' ')} 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      )}
      {validScores.map((s, i) => {
        const coords = points[i].split(',');
        const x = parseFloat(coords[0]);
        const y = parseFloat(coords[1]);
        if (isNaN(x) || isNaN(y)) return null;
        return (
          <circle 
            key={i} 
            cx={x} 
            cy={y} 
            r="3" 
            fill={SEVERITY_COLOR[s] || strokeColor} 
            stroke="#fff" 
            strokeWidth="1.5" 
          />
        );
      })}
    </svg>
  );
}

export default function UserCard({ user, onClick }) {
  if (!user) return null;

  const rs = getRiskStyle(user.risk_level);
  const trend = user.trend || 'Stable';
  
  let TrendIcon = Minus;
  let trendDirection = '→';
  if (trend === 'Deteriorating') { TrendIcon = TrendingDown; trendDirection = '↘'; }
  if (trend === 'Improving') { TrendIcon = TrendingUp; trendDirection = '↗'; }

  const trendColor = { 
    Deteriorating: '#c0392b', 
    Improving: '#2e7d52', 
    Stable: '#1D9E75', 
    'Consistently Critical': '#c0392b', 
    'Consistently Distressed': '#c17f24' 
  }[trend] || '#1D9E75';

  const severity = user.current_severity ?? 0;

  return (
    <div 
      className="user-card-v3" 
      onClick={onClick}
      style={{ borderTop: `4px solid ${rs.accent}` }}
    >
      <div className="uc3-top">
        <div className="uc3-identity">
          <h3 className="uc3-username">u/{user.username || 'anonymous'}</h3>
          <span className="uc3-posts">{user.post_count || 0} posts</span>
        </div>
        <div className="uc3-risk-pill" style={{ background: rs.bg, color: rs.accent }}>
          {rs.label || 'Unknown'}
        </div>
      </div>

      <div className="uc3-middle">
        <div className="uc3-sparkline-container">
          <Sparkline scores={user.scores} />
        </div>
      </div>

      <div className="uc3-bottom">
        <div className="uc3-stat">
          <span className="uc3-stat-label">Severity</span>
          <span className="uc3-stat-val" style={{ color: SEVERITY_COLOR[severity] || 'var(--text-primary)' }}>
            {SEVERITY_LABEL[severity] || 'Normal'}
          </span>
        </div>
        
        <div className="uc3-stat divider"></div>
        
        <div className="uc3-stat">
          <span className="uc3-stat-label">Trend</span>
          <span className="uc3-stat-val" style={{ color: trendColor }}>
            {trend} {trendDirection}
          </span>
        </div>

        <div className="uc3-stat divider"></div>

        <div className="uc3-stat">
          <span className="uc3-stat-label">Confidence</span>
          <span className="uc3-stat-val">
            {Math.round((user.avg_confidence || 0) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
