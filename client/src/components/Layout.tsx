import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── SVG icon set ────────────────────────────────────────────────
const Icon = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  teachers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  subjects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <polyline points="9 16 11 18 15 14"/>
    </svg>
  ),
  fees: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  wages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  ),
  invoices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  tags: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  punch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
};

const sections = [
  {
    label: 'Main',
    items: [
      { to: '/',                  label: 'Dashboard',      icon: Icon.dashboard  },
    ]
  },
  {
    label: 'Management',
    items: [
      { to: '/teachers',          label: 'Teachers',       icon: Icon.teachers   },
      { to: '/students',          label: 'Students',       icon: Icon.students   },
      { to: '/groups',            label: 'Group Classes',  icon: Icon.groups     },
      { to: '/subjects',          label: 'Subjects',       icon: Icon.subjects   },
    ]
  },
  {
    label: 'Attendance',
    items: [
      { to: '/attendance',        label: 'Log Attendance', icon: Icon.attendance },
    ]
  },
  {
    label: 'Payments',
    items: [
      { to: '/payments/students', label: 'Student Fees',   icon: Icon.fees       },
      { to: '/payments/teachers', label: 'Teacher Wages',  icon: Icon.wages      },
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/reports',           label: 'Reports',        icon: Icon.reports    },
      { to: '/invoices',          label: 'Invoices',       icon: Icon.invoices   },
      { to: '/tags',              label: 'Tags',           icon: Icon.tags       },
    ]
  },
  {
    label: 'Admin',
    items: [
      { to: '/users',             label: 'User Accounts',  icon: Icon.users      },
    ]
  }
];

// Map route → page title + subtitle
const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/':                    { title: 'Dashboard',      sub: 'Overview of centre activity' },
  '/teachers':            { title: 'Teachers',       sub: 'Manage teaching staff' },
  '/students':            { title: 'Students',       sub: 'Student roster and profiles' },
  '/groups':              { title: 'Group Classes',  sub: 'Manage group sessions' },
  '/subjects':            { title: 'Subjects',       sub: 'Subject catalogue' },
  '/attendance':          { title: 'Attendance',     sub: 'Log and review sessions' },
  '/payments/students':   { title: 'Student Fees',   sub: 'Monthly fee tracking' },
  '/payments/teachers':   { title: 'Teacher Wages',  sub: 'Monthly wage tracking' },
  '/reports':             { title: 'Reports',        sub: 'Analytics and insights' },
  '/invoices':            { title: 'Invoices',       sub: 'Billing and receipts' },
  '/tags':                { title: 'Tags',           sub: 'Label management' },
  '/users':               { title: 'User Accounts',  sub: 'Admin and teacher logins' },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { title: 'Punch Tuition' };
  const initials = (user?.username ?? 'A').slice(0, 2).toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <circle cx="9" cy="9" r="2.2"/>
              <circle cx="15" cy="9" r="2.2"/>
              <path d="M8 15 Q12 20 16 15" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <h1>punch.</h1>
            <span>Tuition Centre</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section.label}>
              <div className="sidebar-section">{section.label}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-username">{user?.username}</span>
              <span className="sidebar-role">Administrator</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <span style={{ width: 15, height: 15, display: 'inline-flex' }}>{Icon.logout}</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{meta.title}</h2>
            {meta.sub && <p>{meta.sub}</p>}
          </div>
          <div className="topbar-right topbar-action">
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
