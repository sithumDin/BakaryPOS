'use client';

import { useEffect, useMemo, useState } from 'react';

type Period = 'week' | 'month';

interface Ingredient {
  _id?: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
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

interface InventoryResponse {
  ingredients: Ingredient[];
  lowStockItems: Ingredient[];
  usageSummary: UsageItem[];
  period: Period;
}

const DEFAULT_INGREDIENTS: Array<Partial<Ingredient>> = [
  { name: 'Flour', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 10, weeklyUsageTarget: 50, monthlyUsageTarget: 200 },
  { name: 'Margarine', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 5, weeklyUsageTarget: 15, monthlyUsageTarget: 60 },
  { name: 'Cheese', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 3, weeklyUsageTarget: 8, monthlyUsageTarget: 30 },
  { name: 'Chocolate', category: 'Bakery Raw Material', unit: 'kg', stock: 0, lowStockThreshold: 4, weeklyUsageTarget: 10, monthlyUsageTarget: 40 },
];

function formatNumber(value: number) {
  return value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [data, setData] = useState<InventoryResponse>({
    ingredients: [],
    lowStockItems: [],
    usageSummary: [],
    period: 'week',
  });

  const [form, setForm] = useState({
    name: '',
    category: 'Raw Material',
    stock: '',
    unit: 'kg',
    lowStockThreshold: '5',
    weeklyUsageTarget: '0',
    monthlyUsageTarget: '0',
    supplier: '',
    notes: '',
  });

  const [movement, setMovement] = useState({
    ingredientId: '',
    type: 'usage',
    qty: '1',
    note: '',
    reference: '',
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
      setData({ ingredients: [], lowStockItems: [], usageSummary: [], period: selectedPeriod });
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
      category: 'Raw Material',
      stock: '',
      unit: 'kg',
      lowStockThreshold: '5',
      weeklyUsageTarget: '0',
      monthlyUsageTarget: '0',
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

  const handleMovement = async () => {
    if (!movement.ingredientId) {
      alert('Please select an ingredient');
      return;
    }

    const qty = Number(movement.qty) || 0;
    if (qty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    setPosting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: movement.ingredientId,
          type: movement.type,
          qty,
          note: movement.note,
          reference: movement.reference,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Movement failed' }));
        throw new Error(err.error || 'Movement failed');
      }

      setMovement({ ingredientId: '', type: 'usage', qty: '1', note: '', reference: '' });
      await fetchInventory(period);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Movement failed');
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

  const selectedIngredient = useMemo(
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
        <p>Track flour, margarine, cheese, chocolate, and other bakery raw materials by weekly or monthly usage</p>
      </div>

      <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {(['week', 'month'] as Period[]).map((p) => (
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
              {p === 'week' ? 'Weekly Usage' : 'Monthly Usage'}
            </button>
          ))}
          <button
            onClick={handleQuickSeed}
            disabled={saving}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              background: 'var(--warning)',
              color: '#fff',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Adding...' : 'Quick Add Default Materials'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Raw Material Setup</h2>
                {editingId && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Editing</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <input placeholder="Material name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-input" />
                <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-input" />
                <input placeholder="Starting stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="form-input" />
                <input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="form-input" />
                <input placeholder="Low stock threshold" type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="form-input" />
                <input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="form-input" />
                <input placeholder="Weekly usage target" type="number" value={form.weeklyUsageTarget} onChange={(e) => setForm({ ...form, weeklyUsageTarget: e.target.value })} className="form-input" />
                <input placeholder="Monthly usage target" type="number" value={form.monthlyUsageTarget} onChange={(e) => setForm({ ...form, monthlyUsageTarget: e.target.value })} className="form-input" />
                <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="form-input" style={{ gridColumn: '1 / -1', minHeight: '84px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {editingId ? 'Update Material' : 'Add Material'}
                </button>
                <button onClick={resetForm} className="btn" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Clear Form
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0 }}>Usage Entry</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <select value={movement.ingredientId} onChange={(e) => setMovement({ ...movement, ingredientId: e.target.value })} className="form-input">
                  <option value="">Select material</option>
                  {data.ingredients.map((item) => (
                    <option key={item._id} value={item._id}>{item.name} ({item.stock} {item.unit})</option>
                  ))}
                </select>
                <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} className="form-input">
                  <option value="usage">Usage / Consumption</option>
                  <option value="purchase">Purchase / Refill</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="waste">Waste</option>
                </select>
                <input type="number" min="1" value={movement.qty} onChange={(e) => setMovement({ ...movement, qty: e.target.value })} className="form-input" placeholder="Quantity" />
                <input value={movement.reference} onChange={(e) => setMovement({ ...movement, reference: e.target.value })} className="form-input" placeholder="Reference / Batch no." />
                <textarea value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })} className="form-input" placeholder="Note" style={{ gridColumn: '1 / -1', minHeight: '72px', resize: 'vertical' }} />
              </div>
              {selectedIngredient && (
                <p style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {selectedIngredient.name} current stock: <strong>{selectedIngredient.stock} {selectedIngredient.unit}</strong>
                </p>
              )}
              <button onClick={handleMovement} disabled={posting} className="btn btn-secondary" style={{ marginTop: '12px' }}>
                {posting ? 'Saving...' : 'Save Movement'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0 }}>Inventory Summary</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><strong>Total Materials:</strong> {data.ingredients.length}</div>
                <div><strong>Low Stock:</strong> {data.lowStockItems.length}</div>
                <div><strong>Period:</strong> {period === 'week' ? 'Weekly' : 'Monthly'}</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0 }}>Low Stock Alerts</h2>
              {data.lowStockItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No low stock materials right now.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {data.lowStockItems.map((item) => (
                    <div key={item._id} style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.stock} {item.unit} left, threshold {item.lowStockThreshold} {item.unit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', padding: '20px' }}>
              <h2 style={{ marginTop: 0 }}>{period === 'week' ? 'Weekly' : 'Monthly'} Usage</h2>
              {data.usageSummary.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No usage recorded for this period yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {data.usageSummary.map((item) => (
                    <div key={item.ingredientId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <span>{item.name}</span>
                      <strong>{formatNumber(item.qty)} {item.unit}</strong>
                    </div>
                  ))}
                </div>
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
