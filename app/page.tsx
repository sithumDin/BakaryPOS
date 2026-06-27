'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign, ClipboardList, TrendingUp, Package,
  Wheat, Cake, Croissant, Cookie, Sandwich, UtensilsCrossed, Coffee,
  ShoppingCart, Plus, Factory, BarChart2, Archive, CreditCard,
  Calendar, Bell, AlertTriangle, Users,
  type LucideIcon,
} from 'lucide-react';
import { APP_BRANDING } from '@/lib/branding';

interface DashboardData {
  today: { revenue: number; profit: number; count: number };
  week: { revenue: number; profit: number };
  month: { revenue: number; profit: number };
  year: { revenue: number; profit: number };
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  lowStockList: Array<{ _id: string; name: string; stock: number; unit: string }>;
  totalOutstanding: number;
  productionSummary: {
    totalProduced: number; totalSold: number; totalUnsold: number;
    byItem: Record<string, { name: string; unit: string; produced: number; sold: number }>;
  };
  creditBreakdown: { retail: { amount: number; count: number }; wholesale: { amount: number; count: number } };
  recentSales: Array<{ _id: string; invoiceNo: string; customerName: string; total: number; profit: number; saleType: string; paymentMethod: string; date: string }>;
  dailyProfits: Array<{ date: string; profit: number; revenue: number }>;
  categoryBreakdown: Record<string, number>;
  cashierBreakdown: Record<string, { revenue: number; count: number }>;
}

interface Reminder {
  _id: string; text: string; done: boolean;
  createdByName?: string; completedByName?: string;
}

function fmtLKR(n: number) {
  return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ── Mini sparkline SVG ── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 90; const H = 36;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - 4 - ((v - min) / range) * (H - 8),
  }));
  const path = pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = prev.x + (p.x - prev.x) / 2;
    return `${d} C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');
  const area = `${path} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Sales area chart ── */
function SalesChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  if (data.length === 0) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>No data</div>;
  const W = 500; const H = 160; const padL = 8; const padR = 8; const padT = 12; const padB = 28;
  const cW = W - padL - padR; const cH = H - padT - padB;
  const maxV = Math.max(...data.map(d => d.revenue), 1);
  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * cW,
    y: padT + cH - (d.revenue / maxV) * cH,
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    val: d.revenue,
  }));
  const path = pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = prev.x + (p.x - prev.x) / 2;
    return `${d} C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');
  const area = `${path} L${pts[pts.length - 1].x.toFixed(1)},${(padT + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + cH).toFixed(1)} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#chartFill)" />
      <path d={path} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#2563EB" strokeWidth="2" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  'Bread': '#F59E0B', 'Cakes': '#EC4899', 'Pastries': '#8B5CF6',
  'Cookies & Biscuits': '#F97316', 'Rolls & Buns': '#EAB308',
  'Savories': '#22C55E', 'Beverages': '#3B82F6', 'Other': '#94A3B8',
};
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Bread': Wheat, 'Cakes': Cake, 'Pastries': Croissant,
  'Cookies & Biscuits': Cookie, 'Rolls & Buns': Sandwich,
  'Savories': UtensilsCrossed, 'Beverages': Coffee, 'Other': Package,
};

const QUICK_ACTIONS: Array<{ href: string; label: string; icon: LucideIcon; bg: string; color: string }> = [
  { href: '/retail',     label: 'New Order',  icon: ShoppingCart, bg: '#EFF6FF', color: '#2563EB' },
  { href: '/products',   label: 'Add Item',   icon: Plus,         bg: '#F0FDF4', color: '#16A34A' },
  { href: '/production', label: 'Production', icon: Factory,      bg: '#FFF7ED', color: '#C2410C' },
  { href: '/reports',    label: 'Reports',    icon: BarChart2,    bg: '#FDF4FF', color: '#7C3AED' },
  { href: '/inventory',  label: 'Inventory',  icon: Archive,      bg: '#FEF2F2', color: '#DC2626' },
  { href: '/credits',    label: 'Credits',    icon: CreditCard,   bg: '#ECFDF5', color: '#059669' },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [clearingSales, setClearingSales] = useState(false);
  const [userRole, setUserRole] = useState<string>('cashier');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
  }, []);

  const fetchDashboard = async () => {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('Failed');
    setData(await res.json());
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.ok ? r.json() : null),
      fetch('/api/reminders').then(r => r.ok ? r.json() : []),
      fetch('/api/auth/me').then(r => r.ok ? r.json() : { user: null }).catch(() => ({ user: null })),
    ]).then(([d, rem, me]) => {
      if (d) setData(d);
      setReminders(Array.isArray(rem) ? rem : []);
      setUserRole(me?.user?.role || 'cashier');
    }).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  const addReminder = async () => {
    const text = newReminder.trim();
    if (!text || savingReminder) return;
    setSavingReminder(true);
    try {
      const res = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!res.ok) { alert('Failed'); return; }
      setNewReminder('');
      fetch('/api/reminders').then(r => r.json()).then(items => setReminders(Array.isArray(items) ? items : []));
    } finally { setSavingReminder(false); }
  };

  const toggleReminder = async (id: string, done: boolean) => {
    await fetch('/api/reminders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, done }) });
    setReminders(prev => prev.map(r => r._id === id ? { ...r, done } : r));
  };

  const clearSales = async () => {
    if (userRole !== 'admin' || clearingSales || !data || data.recentSales.length === 0) return;
    if (!window.confirm('Clear all sales? This cannot be undone.')) return;
    setClearingSales(true);
    try { await fetch('/api/sales', { method: 'DELETE' }); await fetchDashboard(); } finally { setClearingSales(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <AlertTriangle size={40} color="#F59E0B" strokeWidth={1.5} />
      <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1D23' }}>Unable to Load Dashboard</div>
      <div style={{ fontSize: 13, color: '#9CA3AF' }}>Check your database connection.</div>
    </div>
  );

  const periodData = data[period];
  const revenue = 'revenue' in periodData ? periodData.revenue : 0;
  const profit = 'profit' in periodData ? periodData.profit : 0;
  const avgOrder = data.today.count > 0 ? data.today.revenue / data.today.count : 0;
  const totalSold = data.productionSummary?.totalSold ?? 0;
  const revenueVals = data.dailyProfits.map(d => d.revenue);
  const profitVals = data.dailyProfits.map(d => d.profit);

  const topCategories = Object.entries(data.categoryBreakdown)
    .sort(([, a], [, b]) => b - a).slice(0, 5);

  const creditTotal = (data.creditBreakdown?.retail?.count ?? 0) + (data.creditBreakdown?.wholesale?.count ?? 0);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Overview</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Welcome back! Here's what's happening today.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, border: '1.5px solid #ECEEF5', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            <Calendar size={14} color="#6B7280" strokeWidth={2} />
            {dateStr}
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#F0F2F8', borderRadius: 10, padding: 3 }}>
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: period === p ? '#fff' : 'transparent',
                color: period === p ? '#2563EB' : '#6B7280',
                boxShadow: period === p ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.13s',
              }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard
          label="Total Sales" value={fmtLKR(revenue)}
          sub={period === 'today' ? `${data.today.count} orders today` : undefined}
          icon={DollarSign} iconBg="#EFF6FF" iconColor="#2563EB"
          sparkValues={revenueVals} sparkColor="#2563EB"
          trend={revenue > 0 ? '+5.2%' : undefined} trendUp
        />
        <StatCard
          label="Total Orders" value={String(data.today.count)}
          sub="today"
          icon={ClipboardList} iconBg="#F0FDF4" iconColor="#16A34A"
          sparkValues={data.dailyProfits.map((_, i) => i + 1)} sparkColor="#16A34A"
          trend="+8%" trendUp
        />
        <StatCard
          label="Avg. Order Value" value={fmtLKR(avgOrder)}
          icon={TrendingUp} iconBg="#FEF3C7" iconColor="#F59E0B"
          sparkValues={profitVals} sparkColor="#F59E0B"
        />
        <StatCard
          label="Items Sold" value={String(totalSold)}
          sub="production"
          icon={Package} iconBg="#EDE9FE" iconColor="#8B5CF6"
          sparkValues={revenueVals.map((v, i) => v * (i + 1))} sparkColor="#8B5CF6"
          trend="+5.1%" trendUp
        />
      </div>

      {/* ── Middle Row: Chart | Order Status | Top Items ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 14, marginBottom: 20 }}>

        {/* Sales Overview chart */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>Sales Overview</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Revenue last 7 days</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>This Week</span>
          </div>
          <SalesChart data={data.dailyProfits.map(d => ({ date: d.date, revenue: d.revenue }))} />
        </div>

        {/* Order Status */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 18px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23' }}>Order Status</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Retail Sales',    count: data.recentSales.filter(s => s.saleType === 'retail').length,    dot: '#3B82F6' },
              { label: 'Wholesale',       count: data.recentSales.filter(s => s.saleType === 'wholesale').length,  dot: '#F59E0B' },
              { label: 'Credit Pending',  count: creditTotal,                                                       dot: '#F97316' },
              { label: 'Cash Payments',   count: data.recentSales.filter(s => s.paymentMethod === 'cash').length,  dot: '#22C55E' },
              { label: 'Low Stock',       count: data.lowStockProducts,                                             dot: '#EF4444' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1D23' }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Categories */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 18px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', marginBottom: 16 }}>Top Categories</div>
          {topCategories.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingTop: 20 }}>No sales yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {topCategories.map(([cat, amount]) => {
                const CatIcon = CATEGORY_ICONS[cat] || Package;
                const catColor = CATEGORY_COLORS[cat] || '#94A3B8';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${catColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CatIcon size={17} color={catColor} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtLKR(amount)}</div>
                    </div>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: '#F5F6FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#374151', flexShrink: 0 }}>
                      {Object.values(data.categoryBreakdown).sort((a, b) => b - a).indexOf(amount) + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Recent Sales | Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, marginBottom: 20 }}>

        {/* Recent Sales table */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>Recent Orders</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {userRole === 'admin' && (
                <button onClick={clearSales} disabled={clearingSales || data.recentSales.length === 0} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FECACA',
                  background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700,
                  cursor: data.recentSales.length === 0 ? 'not-allowed' : 'pointer', opacity: data.recentSales.length === 0 ? 0.5 : 1,
                }}>
                  {clearingSales ? 'Clearing…' : 'Clear'}
                </button>
              )}
              <Link href="/reports" style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>View All →</Link>
            </div>
          </div>
          {data.recentSales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: 14 }}>No sales yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F4F5F9' }}>
                    {['Order ID', 'Customer', 'Total', 'Status', 'Time'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.slice(0, 8).map((sale) => (
                    <tr key={sale._id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                      <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{sale.invoiceNo}</td>
                      <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{sale.customerName}</td>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: '#1A1D23', whiteSpace: 'nowrap' }}>{fmtLKR(sale.total)}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                          background: sale.paymentMethod === 'credit' ? '#FFF7ED' : sale.saleType === 'retail' ? '#EFF6FF' : '#F0FDF4',
                          color: sale.paymentMethod === 'credit' ? '#C2410C' : sale.saleType === 'retail' ? '#2563EB' : '#15803D',
                        }}>
                          {sale.paymentMethod === 'credit' ? 'Credit' : sale.saleType === 'retail' ? 'Completed' : 'Wholesale'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        {new Date(sale.date).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions + Reminders stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Quick Actions */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 18px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', marginBottom: 14 }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {QUICK_ACTIONS.map(action => (
                <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', borderRadius: 14,
                    background: action.bg, border: `1.5px solid ${action.bg}`,
                    cursor: 'pointer', transition: 'transform 0.13s',
                  }}>
                    <action.icon size={22} color={action.color} strokeWidth={1.8} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: action.color, textAlign: 'center', lineHeight: 1.2 }}>{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Reminders */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '18px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Bell size={15} color="#2563EB" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23' }}>Reminders</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: '#EFF6FF', color: '#2563EB' }}>
                {reminders.filter(r => !r.done).length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                type="text" placeholder={userRole === 'admin' ? 'Add note…' : 'Admins only'}
                value={newReminder} onChange={e => setNewReminder(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addReminder(); }}
                disabled={userRole !== 'admin' || savingReminder}
                style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 9, border: '1.5px solid #ECEEF5', outline: 'none', background: '#FAFBFF' }}
              />
              <button onClick={addReminder} disabled={userRole !== 'admin' || !newReminder.trim() || savingReminder}
                style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: userRole !== 'admin' ? 0.4 : 1 }}>
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {reminders.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '10px 0' }}>No reminders</div>
              ) : reminders.map(r => (
                <label key={r._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 9, background: r.done ? '#F0FDF4' : '#F8F9FF', border: `1px solid ${r.done ? '#BBF7D0' : '#ECEEF5'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={r.done} onChange={e => toggleReminder(r._id, e.target.checked)} disabled={userRole !== 'admin'} style={{ marginTop: 2, accentColor: '#2563EB' }} />
                  <span style={{ fontSize: 12, color: r.done ? '#9CA3AF' : '#374151', textDecoration: r.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{r.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Production Overview ── */}
      {data.productionSummary && data.productionSummary.totalProduced > 0 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Factory size={16} color="#C2410C" strokeWidth={2} />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>Today's Production</span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {[{ label: 'Produced', val: data.productionSummary.totalProduced, color: '#2563EB' }, { label: 'Sold', val: data.productionSummary.totalSold, color: '#16A34A' }, { label: 'Unsold', val: data.productionSummary.totalUnsold, color: data.productionSummary.totalUnsold > 0 ? '#F97316' : '#16A34A' }].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          {Object.entries(data.productionSummary.byItem).map(([id, item]) => {
            const pct = item.produced > 0 ? Math.min((item.sold / item.produced) * 100, 100) : 0;
            return (
              <div key={id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23' }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{pct.toFixed(0)}% sold</span>
                </div>
                <div style={{ height: 7, background: '#F0F2F8', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: pct >= 100 ? '#16A34A' : 'linear-gradient(90deg, #2563EB, #60A5FA)', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Low Stock + Cashier ── */}
      {(data.lowStockList.length > 0 || Object.keys(data.cashierBreakdown || {}).length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: data.lowStockList.length > 0 && Object.keys(data.cashierBreakdown || {}).length > 0 ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 20 }}>
          {data.lowStockList.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1.5px solid #FED7AA', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={15} color="#C2410C" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#C2410C' }}>Low Stock Alerts</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.lowStockList.map(p => (
                  <div key={p._id} style={{ padding: '6px 14px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 99, fontSize: 13 }}>
                    <strong style={{ color: '#1A1D23' }}>{p.name}</strong>
                    <span style={{ color: '#C2410C', marginLeft: 7, fontWeight: 600 }}>{p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(data.cashierBreakdown || {}).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Users size={15} color="#2563EB" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23' }}>Sales by Cashier</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(data.cashierBreakdown).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, stats]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{stats.count} sale{stats.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#1A1D23' }}>{fmtLKR(stats.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, sparkValues, sparkColor, trend, trendUp }: {
  label: string; value: string; sub?: string;
  icon: LucideIcon; iconBg: string; iconColor: string;
  sparkValues: number[]; sparkColor: string;
  trend?: string; trendUp?: boolean;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1D23', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          {trend && (
            <span style={{ fontSize: 11, fontWeight: 700, color: trendUp ? '#16A34A' : '#DC2626' }}>
              {trendUp ? '↑' : '↓'} {trend}
            </span>
          )}
          {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{sub}</div>}
        </div>
        <Sparkline values={sparkValues} color={sparkColor} />
      </div>
    </div>
  );
}
