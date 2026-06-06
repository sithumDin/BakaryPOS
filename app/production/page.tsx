'use client';

import { useEffect, useState } from 'react';

interface Product {
  _id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
}

interface ProductionRecord {
  _id: string;
  product: { _id: string; name: string; category: string; unit: string };
  qty: number;
  productionDate: string;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ProductionPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [records, setRecords]     = useState<ProductionRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('');

  const isNewDay = records.length === 0;
  const today = formatDate(new Date());

  const fetchData = async () => {
    try {
      const [prodRes, recRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/production/produce'),
      ]);
      const prods = prodRes.ok ? await prodRes.json() : [];
      const recs  = recRes.ok  ? await recRes.json()  : [];
      setProducts(Array.isArray(prods) ? prods : []);
      setRecords(Array.isArray(recs)  ? recs  : []);
    } catch {
      setProducts([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartNewDay = async () => {
    if (!confirm('Reset all product stock to 0 and start a new day?')) return;
    setResetting(true);
    try {
      await fetch('/api/production/reset', { method: 'POST' });
      await fetchData();
    } catch {
      alert('Failed to reset stock');
    } finally {
      setResetting(false);
    }
  };

  const handleRecord = async () => {
    const qtyNum = parseInt(qty, 10);
    if (!selectedProduct || !qtyNum || qtyNum <= 0) {
      alert('Please select a product and enter a valid quantity');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/production/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct, qty: qtyNum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        alert(err.error || 'Failed to record production');
        return;
      }
      setSelectedProduct('');
      setQty('');
      await fetchData();
    } catch {
      alert('Failed to record production');
    } finally {
      setSaving(false);
    }
  };

  // Aggregate today's production per product
  const todaySummary = records.reduce<Record<string, { name: string; unit: string; qty: number }>>((acc, r) => {
    const id = r.product._id;
    if (!acc[id]) acc[id] = { name: r.product.name, unit: r.product.unit, qty: 0 };
    acc[id].qty += r.qty;
    return acc;
  }, {});

  const totalProduced = records.reduce((s, r) => s + r.qty, 0);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>🍞 Daily Production</h1>
          <p>{today}</p>
        </div>
        <button
          className="btn btn-danger"
          onClick={handleStartNewDay}
          disabled={resetting}
        >
          {resetting ? 'Resetting...' : '🔄 Start New Day (Reset Stock)'}
        </button>
      </div>

      {/* New day banner */}
      {isNewDay && (
        <div style={{
          background: '#FEF9C3',
          border: '1px solid #FDE047',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '22px' }}>☀️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#713F12', fontSize: '15px' }}>New Day — No production recorded yet</div>
            <div style={{ fontSize: '13px', color: '#92400E', marginTop: '2px' }}>
              Click <strong>Start New Day</strong> to reset all product stock to 0, then record today&apos;s production.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="stat-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Produced Today</span>
            <div className="stat-card-icon green">🥐</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--green-600)' }}>{totalProduced}</div>
          <div className="stat-card-change">
            {Object.keys(todaySummary).length} product type{Object.keys(todaySummary).length !== 1 ? 's' : ''}
          </div>
        </div>

        {Object.values(todaySummary).map((s) => (
          <div key={s.name} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <div className="stat-card-icon green">🍞</div>
            </div>
            <div className="stat-card-value" style={{ color: 'var(--green-600)' }}>{s.qty}</div>
            <div className="stat-card-change">{s.unit} today</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Record Production */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '18px' }}>Record Production</h3>

          <div className="form-group">
            <label className="form-label">Product</label>
            <select
              className="form-select"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — stock: {p.stock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Quantity Produced</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRecord(); }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRecord}
            disabled={saving || !selectedProduct || !qty}
            style={{ width: '100%' }}
          >
            {saving ? 'Saving...' : '✓ Record Production'}
          </button>
        </div>

        {/* Current Stock */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Current Stock</h3>
          {products.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No products found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {products.map((p) => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.category}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: p.stock > 0 ? 'var(--green-600)' : 'var(--danger)' }}>
                      {p.stock}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's production log */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Today&apos;s Production Log</h3>

        {records.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <span className="icon">🍞</span>
            <h3>No production recorded today</h3>
            <p>Use the form to record what you baked.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Qty Added</th>
                  <th>Unit</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.product.name}</td>
                    <td><span className="badge badge-neutral">{r.product.category}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-600)', fontSize: '15px' }}>+{r.qty}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.product.unit}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                      {new Date(r.productionDate).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
