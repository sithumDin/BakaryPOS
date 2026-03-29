'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/retail', label: 'Retail Sales', icon: '🛒' },
  { href: '/wholesale', label: 'Wholesale', icon: '🏭' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/reports', label: 'Reports', icon: '📈' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; username: string; role: string } | null>(null);

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
        })
        .catch(console.error);
    }
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (pathname === '/login') return null;

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo">🌿</div>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Govi Sewana</span>
        </div>
        <button className="menu-btn" onClick={() => setOpen(true)}>☰</button>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">🌿</div>
          <div className="sidebar-brand">
            <h1>Govi Sewana</h1>
            <p>Agribusiness POS</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto', paddingTop: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: 'var(--emerald-600)', color: 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' 
                }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '6px', fontSize: '12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
             <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Loading...</div>
          )}
        </div>
      </aside>
    </>
  );
}
