import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '📊' }] },
  {
    section: 'Management',
    items: [
      { to: '/teachers', label: 'Teachers', icon: '👩‍🏫' },
      { to: '/students', label: 'Students', icon: '🎒' },
      { to: '/groups', label: 'Group Classes', icon: '👥' },
      { to: '/subjects', label: 'Subjects', icon: '📚' }
    ]
  },
  { section: 'Attendance', items: [{ to: '/attendance', label: 'Log Attendance', icon: '📅' }] },
  {
    section: 'Payments',
    items: [
      { to: '/payments/students', label: 'Student Fees', icon: '💰' },
      { to: '/payments/teachers', label: 'Teacher Wages', icon: '💼' }
    ]
  },
  {
    section: 'Finance',
    items: [
      { to: '/reports', label: 'Reports', icon: '📈' },
      { to: '/invoices', label: 'Invoices', icon: '🧾' },
      { to: '/tags', label: 'Tags', icon: '🏷️' }
    ]
  },
  {
    section: 'Admin',
    items: [
      { to: '/users', label: 'User Accounts', icon: '🔐' }
    ]
  }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Punch Tuition</h1>
          <span>Centre Management</span>
        </div>
        <nav className="sidebar-nav">
          {links.map(section => (
            <div key={section.section}>
              <div className="sidebar-section">{section.section}</div>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-username">{user?.username}</span>
            <span className="badge badge-purple">Admin</span>
          </div>
          <button className="btn btn-outline btn-sm btn-full" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>
      <main className="main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
