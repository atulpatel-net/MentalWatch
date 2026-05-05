import UserCard from "./UserCard"

export default function Dashboard({ data }) {
  const { subreddit, total_posts_analyzed, total_users, analysis_time_seconds, users } = data

  const alerts   = users.filter(u => u.risk_level === "High").length
  const monitors = users.filter(u => u.risk_level === "Medium").length
  const safe     = users.filter(u => u.risk_level === "Low").length

  return (
    <section className="dashboard">
      {/* Summary bar */}
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value">r/{subreddit}</span>
          <span className="summary-label">Subreddit</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{total_posts_analyzed}</span>
          <span className="summary-label">Posts Analysed</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{total_users}</span>
          <span className="summary-label">Users</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{analysis_time_seconds}s</span>
          <span className="summary-label">Analysis Time</span>
        </div>
      </div>

      {/* Risk chips */}
      <div className="risk-chips">
        <span className="chip chip-red">🔴 {alerts} Alert</span>
        <span className="chip chip-yellow">⚠️ {monitors} Monitor</span>
        <span className="chip chip-green">🟢 {safe} Safe</span>
      </div>

      {/* User cards */}
      <div className="cards-grid">
        {users.map(user => (
          <UserCard key={user.username} user={user} />
        ))}
      </div>
    </section>
  )
}
