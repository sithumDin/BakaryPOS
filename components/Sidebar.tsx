'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, ChefHat, Factory,
  Settings2, Archive, CreditCard, FileText, Users, BarChart2,
  UserCog, Lock, Unlock, LogOut, type LucideIcon,
} from 'lucide-react';
import { SHOP_BRANDING } from '@/lib/branding';

const navItems: Array<{ href: string; label: string; icon: LucideIcon; adminOnly?: boolean }> = [
  { href: '/',            label: 'Overview',      icon: LayoutDashboard },
  { href: '/retail',      label: 'Retail Sales',  icon: ShoppingCart },
  { href: '/wholesale',   label: 'Wholesale',     icon: Package },
  { href: '/products',    label: 'Products',      icon: ChefHat },
  { href: '/production',  label: 'Production',    icon: Factory },
  { href: '/machines',    label: 'Machines',      icon: Settings2 },
  { href: '/inventory',   label: 'Inventory',     icon: Archive },
  { href: '/credits',     label: 'Credits',       icon: CreditCard },
  { href: '/quotations',  label: 'Quotations',    icon: FileText },
  { href: '/customers',   label: 'Customers',     icon: Users },
  { href: '/reports',     label: 'Reports',       icon: BarChart2 },
  { href: '/users',       label: 'Users',         icon: UserCog, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; username: string; role: string } | null>(null);
  const [startingLockdown, setStartingLockdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLockdownMode, setIsLockdownMode] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [todayStats, setTodayStats] = useState<{ revenue: number; count: number } | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const allowExitRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const checkLogo = async () => {
      try {
        const res = await fetch('/api/logo');
        if (res.headers.get('content-type')?.includes('image')) setLogoUrl('/api/logo');
      } catch {}
    };
    checkLogo();
    fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.today) setTodayStats({ revenue: d.today.revenue, count: d.today.count });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    setIsLockdownMode(params.get('lockdown') === '1');
    setAllowedDomain(params.get('allowedDomain') || window.location.hostname);
  }, [mounted, pathname]);

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user); }).catch(() => {});
    }
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please select a valid image file'); return; }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/logo', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json().catch(() => ({ error: 'Upload failed' })); alert(d.error || 'Failed'); return; }
      const data = await res.json();
      setLogoUrl(data.url + '?t=' + Date.now());
      setShowLogoUpload(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
      alert('Logo uploaded!');
    } catch { alert('Failed to upload logo'); } finally { setUploadingLogo(false); }
  };

  const handleStartLockdown = () => {
    if (typeof window === 'undefined' || startingLockdown) return;
    setStartingLockdown(true);
    const url = new URL(window.location.href);
    url.searchParams.set('lockdown', '1');
    url.searchParams.set('allowedDomain', window.location.hostname);
    const w = window.screen.availWidth || window.screen.width;
    const h = window.screen.availHeight || window.screen.height;
    const popup = window.open(url.toString(), 'pos_lockdown_window', `popup=yes,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes,width=${w},height=${h},left=0,top=0`);
    if (!popup) { setStartingLockdown(false); alert('Popup blocked.'); return; }
    const openFullscreen = () => { try { popup.focus(); (popup.document?.documentElement as HTMLElement)?.requestFullscreen?.().catch(() => {}); } catch {} };
    if (popup.document?.readyState === 'complete') openFullscreen(); else popup.addEventListener('load', openFullscreen, { once: true });
    setStartingLockdown(false);
  };

  const handleExitLockdown = async () => {
    if (!user || user.role !== 'admin') return;
    const password = window.prompt('Enter admin password:');
    if (!password) return;
    const verify = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password }) });
    if (!verify.ok) { alert('Incorrect password.'); return; }
    allowExitRef.current = true;
    if (window.opener && !window.opener.closed) { window.close(); return; }
    const safeUrl = new URL(window.location.href);
    safeUrl.searchParams.delete('lockdown'); safeUrl.searchParams.delete('allowedDomain');
    window.location.replace(safeUrl.toString());
  };

  useEffect(() => {
    if (!isLockdownMode) return;
    if (allowedDomain && !window.location.hostname.includes(allowedDomain)) { window.location.replace(`${window.location.protocol}//${allowedDomain}`); return; }
    const blocked = (e: KeyboardEvent) => { const k = e.key; if ((e.altKey && (k === 'F4' || k === 'Tab')) || (e.ctrlKey && ['w','t','n','Tab'].includes(k.toLowerCase())) || k === 'F1' || k === 'Meta') { e.preventDefault(); e.stopPropagation(); } };
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    const confirmExit = (e: BeforeUnloadEvent) => { if (allowExitRef.current) return; e.preventDefault(); e.returnValue = 'Exit POS Lockdown Mode?'; };
    window.addEventListener('keydown', blocked, true);
    window.addEventListener('contextmenu', blockCtx);
    window.addEventListener('beforeunload', confirmExit);
    return () => { window.removeEventListener('keydown', blocked, true); window.removeEventListener('contextmenu', blockCtx); window.removeEventListener('beforeunload', confirmExit); };
  }, [allowedDomain, isLockdownMode]);

  if (pathname === '/login') return null;

  const visibleItems = navItems.filter(item => !(item as any).adminOnly || user?.role === 'admin');

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo" style={{ cursor: user?.role === 'admin' ? 'pointer' : 'default' }} onClick={() => user?.role === 'admin' && setShowLogoUpload(true)}>
            {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} /> : <ChefHat size={20} color="#fff" strokeWidth={1.8} />}
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{SHOP_BRANDING.name}</span>
        </div>
        <button className="menu-btn" onClick={() => setOpen(true)}>☰</button>
      </div>

      <div className={`mobile-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      {/* ══ SIDEBAR ══ */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>

        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #F0F2F8', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              onClick={() => user?.role === 'admin' && setShowLogoUpload(true)}
              style={{
                width: 42, height: 42, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                background: logoUrl ? 'transparent' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                cursor: user?.role === 'admin' ? 'pointer' : 'default',
                boxShadow: '0 4px 12px rgba(37,99,235,0.22)',
              }}
            >
              {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ChefHat size={22} color="#fff" strokeWidth={1.8} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{SHOP_BRANDING.name}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, marginTop: 1 }}>Bakery POS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  background: isActive ? '#EFF6FF' : 'transparent',
                  color: isActive ? '#2563EB' : '#6B7280',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13, transition: 'all 0.13s',
                  border: isActive ? '1.5px solid #BFDBFE' : '1.5px solid transparent',
                }}
              >
                <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {isActive && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />}
              </Link>
            );
          })}
        </nav>

        {/* Today's summary box */}
        {todayStats && (
          <div style={{ margin: '0 10px 10px', borderRadius: 14, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '1.5px solid #BFDBFE', padding: '12px 14px', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Today's Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>Revenue</span>
                <span style={{ fontWeight: 700, color: '#1A1D23' }}>LKR {todayStats.revenue.toLocaleString('en-LK', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>Sales</span>
                <span style={{ fontWeight: 700, color: '#1A1D23' }}>{todayStats.count}</span>
              </div>
            </div>
          </div>
        )}

        {/* Lockdown */}
        {mounted && (
          <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
            {!isLockdownMode ? (
              <button onClick={handleStartLockdown} style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Lock size={13} strokeWidth={2.2} /> {startingLockdown ? 'Starting…' : 'Lockdown Mode'}
              </button>
            ) : user?.role === 'admin' ? (
              <button onClick={handleExitLockdown} style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #FDE68A', background: '#FFFBEB', color: '#92400E', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Unlock size={13} strokeWidth={2.2} /> Exit Lockdown
              </button>
            ) : null}
          </div>
        )}

        {/* User */}
        <div style={{ padding: '10px 16px 16px', borderTop: '1px solid #F0F2F8', flexShrink: 0 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{user.role}</span>
                </div>
              </div>
              <button onClick={handleLogout} title="Sign Out" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#F5F6FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#9CA3AF' }}>
                <LogOut size={15} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div>
          )}
        </div>
      </aside>

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <div className="modal-overlay" onClick={() => !uploadingLogo && setShowLogoUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Upload Logo</h3>
              <input ref={logoFileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} disabled={uploadingLogo}
                style={{ width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14 }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>PNG, JPG or GIF. Recommended 100×100px.</p>
              {logoUrl && <div style={{ margin: '14px 0', textAlign: 'center' }}><img src={logoUrl} alt="Current" style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8 }} /></div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setShowLogoUpload(false)} disabled={uploadingLogo} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
                  {uploadingLogo ? 'Uploading…' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
