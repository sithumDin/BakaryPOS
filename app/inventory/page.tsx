'use client';

import { useEffect, useMemo, useState } from 'react';

type Period = 'day' | 'week' | 'month';

interface Ingredient {
  _id?: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  dailyUsageTarget: number;
  weeklyUsageTarget: number;
  monthlyUsageTarget: number;
  supplier: string;
  notes: string;
  createdAt?: string;
}

interface UsageItem {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
}

interface DailySummaryItem {
  ingredientId: string;
  name: string;
  unit: string;
  openingStock: number;
  topupToday: number;
  usedToday: number;
  remaining: number;
}

interface InventoryResponse {
  ingredients: Ingredient[];
  lowStockItems: Ingredient[];
  usageSummary: UsageItem[];
  dailySummary: DailySummaryItem[];
  period: Period;
}

const DEFAULT_INGREDIENTS: Array<Partial<Ingredient>> = [
  { name: 'Flour', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 10, dailyUsageTarget: 7, weeklyUsageTarget: 50, monthlyUsageTarget: 200 },
  { name: 'Margarine', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 5, dailyUsageTarget: 2, weeklyUsageTarget: 15, monthlyUsageTarget: 60 },
  { name: 'Cheese', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 3, dailyUsageTarget: 1, weeklyUsageTarget: 8, monthlyUsageTarget: 30 },
  { name: 'Chocolate', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 4, dailyUsageTarget: 1, weeklyUsageTarget: 10, monthlyUsageTarget: 40 },
];

function formatNumber(value: number) {
  return value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryPage() {
  const [period, setPeriod] = useState<Period>('day');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [data, setData] = useState<InventoryResponse>({
    ingredients: [],
    lowStockItems: [],
    usageSummary: [],
    dailySummary: [],
    period: 'day',
  });

  const [form, setForm] = useState({
    name: '',
    category: '',
    stock: '',
    unit: '',
    lowStockThreshold: '',
    dailyUsageTarget: '',
    weeklyUsageTarget: '',
    monthlyUsageTarget: '',
    supplier: '',
    notes: '',
  });

  const [topup, setTopup] = useState({
    ingredientId: '',
    qty: '',
    reference: '',
    note: '',
  });
  const [toppingUp, setToppingUp] = useState(false);

  const [movement, setMovement] = useState({
    ingredientId: '',
    type: 'usage',
    qty: '',
    note: '',
  });

  const fetchInventory = async (selectedPeriod: Period = period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to load inventory');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error(error);
      setData({ ingredients: [], lowStockItems: [], usageSummary: [], dailySummary: [], period: selectedPeriod });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const resetForm = () => {
    setEditingId('');
    setForm({
      name: '',
      category: '',
      stock: '',
      unit: '',
      lowStockThreshold: '',
      dailyUsageTarget: '',
      weeklyUsageTarget: '',
      monthlyUsageTarget: '',
      supplier: '',
      notes: '',
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Please enter an ingredient name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        _id: editingId || undefined,
        name: form.name.trim(),
        category: form.category.trim() || 'Raw Material',
        stock: Number(form.stock) || 0,
        unit: form.unit,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        dailyUsageTarget: Number(form.dailyUsageTarget) || 0,
        weeklyUsageTarget: Number(form.weeklyUsageTarget) || 0,
        monthlyUsageTarget: Number(form.monthlyUsageTarget) || 0,
        supplier: form.supplier.trim(),
        notes: form.notes.trim(),
      };

      const res = await fetch('/api/inventory', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save item' }));
        throw new Error(err.error || 'Failed to save item');
      }

      resetForm();
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient._id || '');
    setForm({
      name: ingredient.name,
      category: ingredient.category,
      stock: String(ingredient.stock),
      unit: ingredient.unit,
      lowStockThreshold: String(ingredient.lowStockThreshold),
      dailyUsageTarget: String(ingredient.dailyUsageTarget ?? 0),
      weeklyUsageTarget: String(ingredient.weeklyUsageTarget),
      monthlyUsageTarget: String(ingredient.monthlyUsageTarget),
      supplier: ingredient.supplier || '',
      notes: ingredient.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (ingredient: Ingredient) => {
    if (!ingredient._id) return;
    const ok = window.confirm(`Delete ${ingredient.name}?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/inventory?id=${ingredient._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || 'Delete failed');
      }
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const handleTopup = async () => {
    if (!topup.ingredientId) { alert('Please select a material'); return; }
    const qty = Number(topup.qty);
    if (!qty || qty <= 0) { alert('Quantity must be greater than 0'); return; }
    setToppingUp(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId: topup.ingredientId, type: 'purchase', qty, note: topup.note, reference: topup.reference }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Top up failed' })); throw new Error(err.error || 'Top up failed'); }
      setTopup({ ingredientId: '', qty: '', reference: '', note: '' });
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Top up failed');
    } finally {
      setToppingUp(false);
    }
  };

  const handleMovement = async () => {
    if (!movement.ingredientId) { alert('Please select a material'); return; }
    const qty = Number(movement.qty);
    if (!qty || qty <= 0) { alert('Quantity must be greater than 0'); return; }
    setPosting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId: movement.ingredientId, type: movement.type, qty, note: movement.note }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Save failed' })); throw new Error(err.error || 'Save failed'); }
      setMovement({ ingredientId: '', type: 'usage', qty: '', note: '' });
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setPosting(false);
    }
  };

  const handleQuickSeed = async () => {
    setSaving(true);
    try {
      for (const item of DEFAULT_INGREDIENTS) {
        const existing = data.ingredients.find((ingredient) => ingredient.name.toLowerCase() === item.name?.toLowerCase());
        if (existing) continue;

        await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert('Failed to seed default ingredients');
    } finally {
      setSaving(false);
    }
  };

  const topupIngredient = useMemo(
    () => data.ingredients.find((item) => item._id === topup.ingredientId),
    [data.ingredients, topup.ingredientId]
  );
  const usageIngredient = useMemo(
    () => data.ingredients.find((item) => item._id === movement.ingredientId),
    [data.ingredients, movement.ingredientId]
  );

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>🧾 Inventory Management</h1>
        <p>Track bakery raw materials — add materials, top up stock, and record daily usage</p>
      </div>

      <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto' }}>

        {/* ── Period toggles ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                background: period === p ? 'var(--emerald-500)' : 'var(--bg-card)',
                color: period === p ? '#fff' : 'var(--text-primary)',
              }}
            >
              {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
          <button
            onClick={handleQuickSeed}
            disabled={saving}
            style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontWeight: 700, background: 'var(--warning)', color: '#fff', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Adding...' : 'Quick Add Default Materials'}
          </button>
        </div>

        {/* ── Main 3-column grid: each column is self-contained ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>

          {/* Col 1 — Raw Material Setup */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Raw Material Setup</h2>
                {editingId && <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '13px' }}>Editing</span>}
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <input placeholder="Material name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-input" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-input" />
                  <input placeholder="Unit (kg, L…)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="form-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input placeholder="Starting stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="form-input" />
                  <input placeholder="Low stock alert" type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="form-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <input placeholder="Daily target" type="number" value={form.dailyUsageTarget} onChange={(e) => setForm({ ...form, dailyUsageTarget: e.target.value })} className="form-input" />
                  <input placeholder="Weekly target" type="number" value={form.weeklyUsageTarget} onChange={(e) => setForm({ ...form, weeklyUsageTarget: e.target.value })} className="form-input" />
                  <input placeholder="Monthly target" type="number" value={form.monthlyUsageTarget} onChange={(e) => setForm({ ...form, monthlyUsageTarget: e.target.value })} className="form-input" />
                </div>
                <input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="form-input" />
                <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="form-input" style={{ minHeight: '72px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving…' : editingId ? 'Update Material' : 'Add Material'}
                </button>
                <button onClick={resetForm} className="btn" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>Clear</button>
              </div>
            </div>

            {/* Overview pill — sits below Raw Material Setup */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '16px 20px', display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div style={{ fontSize: '14px' }}><strong style={{ fontSize: '22px' }}>{data.ingredients.length}</strong><br /><span style={{ color: 'var(--text-muted)' }}>materials</span></div>
              <div style={{ width: '1px', background: 'var(--border-color)', alignSelf: 'stretch' }} />
              <div style={{ fontSize: '14px', color: data.lowStockItems.length > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                <strong style={{ fontSize: '22px' }}>{data.lowStockItems.length}</strong><br />low stock
              </div>
            </div>
          </div>

          {/* Col 2 — Top Up Materials + Low Stock Alerts */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid #22c55e44', padding: '20px' }}>
              <h2 style={{ marginTop: 0, color: '#22c55e' }}>Top Up Materials</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '14px' }}>Add new stock / purchase refill</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                <select value={topup.ingredientId} onChange={(e) => setTopup({ ...topup, ingredientId: e.target.value })} className="form-input">
                  <option value="">Select material</option>
                  {data.ingredients.map((item) => (
                    <option key={item._id} value={item._id}>{item.name} — {item.stock} {item.unit} in stock</option>
                  ))}
                </select>
                {topupIngredient && (
                  <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 'var(--radius-md)', fontSize: '13px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    Current stock: <strong>{topupIngredient.stock} {topupIngredient.unit}</strong>
                  </div>
                )}
                <input type="number" min="0" placeholder="Quantity to add *" value={topup.qty} onChange={(e) => setTopup({ ...topup, qty: e.target.value })} className="form-input" />
                <input placeholder="Reference / Batch no." value={topup.reference} onChange={(e) => setTopup({ ...topup, reference: e.target.value })} className="form-input" />
                <textarea placeholder="Note (optional)" value={topup.note} onChange={(e) => setTopup({ ...topup, note: e.target.value })} className="form-input" style={{ minHeight: '72px', resize: 'vertical' }} />
              </div>
              <button onClick={handleTopup} disabled={toppingUp} className="btn" style={{ marginTop: '14px', background: '#22c55e', color: '#fff', width: '100%', fontWeight: 700 }}>
                {toppingUp ? 'Saving…' : '+ Top Up Stock'}
              </button>
            </div>

            {/* Low Stock Alerts — fills blank below Top Up */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0, fontSize: '16px' }}>Low Stock Alerts</h2>
              {data.lowStockItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>All materials sufficiently stocked.</p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {data.lowStockItems.map((item) => (
                    <div key={item._id} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{item.name}</span>
                      <span style={{ fontSize: '13px', color: '#ef4444' }}>{item.stock} / {item.lowStockThreshold} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Col 3 — Record Usage + Stock Summary */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid rgba(239,68,68,0.3)', padding: '20px' }}>
              <h2 style={{ marginTop: 0, color: '#ef4444' }}>Record Usage</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '14px' }}>Log daily consumption or waste</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                <select value={movement.ingredientId} onChange={(e) => setMovement({ ...movement, ingredientId: e.target.value })} className="form-input">
                  <option value="">Select material</option>
                  {data.ingredients.map((item) => (
                    <option key={item._id} value={item._id}>{item.name} — {item.stock} {item.unit} in stock</option>
                  ))}
                </select>
                {usageIngredient && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', fontSize: '13px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Current stock: <strong>{usageIngredient.stock} {usageIngredient.unit}</strong>
                  </div>
                )}
                <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} className="form-input">
                  <option value="usage">Usage / Consumption</option>
                  <option value="waste">Waste</option>
                </select>
                <input type="number" min="0" placeholder="Quantity used *" value={movement.qty} onChange={(e) => setMovement({ ...movement, qty: e.target.value })} className="form-input" />
                <textarea placeholder="Note (optional)" value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })} className="form-input" style={{ minHeight: '72px', resize: 'vertical' }} />
              </div>
              <button onClick={handleMovement} disabled={posting} className="btn" style={{ marginTop: '14px', background: '#ef4444', color: '#fff', width: '100%', fontWeight: 700 }}>
                {posting ? 'Saving…' : '− Record Usage'}
              </button>
            </div>

            {/* Stock Summary — fills blank below Record Usage */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0, fontSize: '16px' }}>
                {period === 'day' ? "Today's Stock Summary" : period === 'week' ? 'Weekly Usage' : 'Monthly Usage'}
              </h2>
              {period === 'day' ? (
                data.dailySummary.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>No stock movements today yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {data.dailySummary.map((item) => (
                      <div key={item.ingredientId} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>{item.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Opening</span>
                          <span style={{ textAlign: 'right' }}>{formatNumber(item.openingStock)} {item.unit}</span>
                          <span style={{ color: '#22c55e' }}>+ Top up</span>
                          <span style={{ textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>+{formatNumber(item.topupToday)} {item.unit}</span>
                          <span style={{ color: '#ef4444' }}>− Used</span>
                          <span style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>−{formatNumber(item.usedToday)} {item.unit}</span>
                          <span style={{ fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '5px' }}>Remaining</span>
                          <span style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '5px', color: item.remaining <= 0 ? '#ef4444' : 'var(--text-primary)' }}>{formatNumber(item.remaining)} {item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                data.usageSummary.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>No usage recorded for this period.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {data.usageSummary.map((item) => (
                      <div key={item.ingredientId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                        <span>{item.name}</span>
                        <strong>{formatNumber(item.qty)} {item.unit}</strong>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>All Materials</h2>
            <span style={{ color: 'var(--text-muted)' }}>{data.ingredients.length} records</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Stock</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Threshold</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Daily Target</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Weekly Target</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Monthly Target</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.ingredients.map((item) => {
                  const low = item.stock <= item.lowStockThreshold;
                  return (
                    <tr key={item._id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px' }}>{item.category}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: low ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 700 }}>{item.stock} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.lowStockThreshold} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.dailyUsageTarget ?? 0} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.weeklyUsageTarget} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.monthlyUsageTarget} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => handleEdit(item)} className="btn" style={{ background: 'var(--info)', color: '#fff', padding: '6px 10px' }}>Edit</button>
                          <button onClick={() => handleDelete(item)} className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '6px 10px' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
