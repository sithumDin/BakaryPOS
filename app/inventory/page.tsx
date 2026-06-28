'use client';

import { useEffect, useMemo, useState } from 'react';

type Period = 'day' | 'week' | 'month';

interface Ingredient {
  _id?: string;
  name: string;
  category: string;
  stock: number;
  costPrice?: number;
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
    costPrice: '',
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

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

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
      costPrice: '',
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
        costPrice: Number(form.costPrice) || 0,
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
      setShowModal(false);
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
      costPrice: String(ingredient.costPrice ?? 0),
      unit: ingredient.unit,
      lowStockThreshold: String(ingredient.lowStockThreshold),
      dailyUsageTarget: String(ingredient.dailyUsageTarget ?? 0),
      weeklyUsageTarget: String(ingredient.weeklyUsageTarget),
      monthlyUsageTarget: String(ingredient.monthlyUsageTarget),
      supplier: ingredient.supplier || '',
      notes: ingredient.notes || '',
    });
    setShowModal(true);
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
      setShowRestockModal(false);
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
      setShowUsageModal(false);
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

  // Derived data for UI
  const outOfStockCount = data.ingredients.filter((i) => i.stock <= 0).length;
  const totalStockUnits = data.ingredients.reduce((sum, i) => sum + i.stock, 0);
  const categories = [...new Set(data.ingredients.map((i) => i.category).filter(Boolean))];

  const getStockStatus = (item: Ingredient) => {
    if (item.stock <= 0) return 'out';
    if (item.stock <= item.lowStockThreshold) return 'low';
    return 'ok';
  };

  const filteredIngredients = data.ingredients.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || (item.supplier || '').toLowerCase().includes(q);
    const matchCategory = !categoryFilter || item.category === categoryFilter;
    const status = getStockStatus(item);
    const matchStock = stockFilter === 'all' || status === stockFilter;
    return matchSearch && matchCategory && matchStock;
  });

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    padding: '16px 20px',
    border: '1px solid #ECEEF5',
    boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    display: 'block',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: 1440, margin: '0 auto' }}>

      {/* ── Header Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Inventory</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>Track stock levels and manage inventory</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period Toggles */}
          <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  background: period === p ? '#2563EB' : 'transparent',
                  color: period === p ? '#fff' : '#6B7280',
                  transition: 'all 0.15s',
                }}
              >
                {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          <button
            onClick={handleQuickSeed}
            disabled={saving}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: '#fff', color: '#374151', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Adding…' : 'Quick Add Defaults'}
          </button>
          <button
            onClick={() => setShowUsageModal(true)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: '#fff', color: '#374151' }}
          >
            − Record Usage
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn btn-primary"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Low Stock Warning Banner ── */}
      {data.lowStockItems.length > 0 && (
        <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#C2410C', flexWrap: 'wrap' }}>
          <span>⚠️</span>
          <strong>{data.lowStockItems.length} item{data.lowStockItems.length > 1 ? 's are' : ' is'} running low:</strong>
          {data.lowStockItems.map((item, i) => (
            <span key={item._id}>{i > 0 ? ', ' : ''}{item.name} ({item.stock} {item.unit})</span>
          ))}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Items</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1A1D23' }}>{data.ingredients.length}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>ingredients tracked</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Low Stock</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: data.lowStockItems.length > 0 ? '#D97706' : '#1A1D23' }}>{data.lowStockItems.length}</span>
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>need restocking</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Out of Stock</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚫</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: outOfStockCount > 0 ? '#DC2626' : '#1A1D23' }}>{outOfStockCount}</span>
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>completely empty</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Stock</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1A1D23' }}>{formatNumber(totalStockUnits)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>combined units</div>
        </div>
      </div>

      {/* ── Search + Filter Row ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search by name, category, supplier…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: 50, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#374151' }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, color: '#374151', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, color: '#374151', cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">All Stock</option>
          <option value="ok">OK</option>
          <option value="low">Low</option>
          <option value="out">Out</option>
        </select>
      </div>

      {/* ── Inventory Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #ECEEF5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#1A1D23', fontSize: 15 }}>All Materials</span>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>{filteredIngredients.length} of {data.ingredients.length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Material</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stock</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 120 }}>Level</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Threshold</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Daily Target</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF', fontSize: 14 }}>
                    No materials found.
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((item) => {
                  const status = getStockStatus(item);
                  const maxRef = Math.max(item.lowStockThreshold * 3, item.stock, 1);
                  const pct = Math.min(100, (item.stock / maxRef) * 100);
                  const barColor = status === 'out' ? '#DC2626' : status === 'low' ? '#D97706' : '#2563EB';
                  return (
                    <tr key={item._id} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#1A1D23', fontSize: 14 }}>{item.name}</div>
                        {item.supplier && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{item.supplier}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: 13 }}>{item.category}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', color: status === 'out' ? '#DC2626' : status === 'low' ? '#D97706' : '#1A1D23' }}>
                        {item.stock} {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px', minWidth: 120 }}>
                        <div style={{ background: '#F3F4F6', borderRadius: 99, height: 6, width: '100%', overflow: 'hidden' }}>
                          <div style={{ background: barColor, borderRadius: 99, height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background: status === 'out' ? '#FEE2E2' : status === 'low' ? '#FEF3C7' : '#DCFCE7',
                          color: status === 'out' ? '#DC2626' : status === 'low' ? '#D97706' : '#16A34A',
                        }}>
                          {status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#6B7280', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {item.lowStockThreshold} {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#6B7280', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {item.dailyUsageTarget ?? 0} {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          <button
                            onClick={() => { setTopup({ ...topup, ingredientId: item._id || '' }); setShowRestockModal(true); }}
                            style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: '#DCFCE7', color: '#16A34A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            Restock
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: '#DBEAFE', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stock Summary ── */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', padding: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1A1D23' }}>
          {period === 'day' ? "Today's Stock Summary" : period === 'week' ? 'Weekly Usage' : 'Monthly Usage'}
        </h2>
        {period === 'day' ? (
          data.dailySummary.length === 0 ? (
            <p style={{ color: '#9CA3AF', margin: 0, fontSize: 14 }}>No stock movements today yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {data.dailySummary.map((item) => (
                <div key={item.ingredientId} style={{ background: '#F9FAFB', borderRadius: 14, padding: '12px 16px', border: '1px solid #ECEEF5' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#1A1D23', fontSize: 14 }}>{item.name}</div>
                  <div style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9CA3AF' }}>Opening</span>
                      <span style={{ color: '#374151' }}>{formatNumber(item.openingStock)} {item.unit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#16A34A' }}>+ Top up</span>
                      <span style={{ color: '#16A34A', fontWeight: 600 }}>+{formatNumber(item.topupToday)} {item.unit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#DC2626' }}>− Used</span>
                      <span style={{ color: '#DC2626', fontWeight: 600 }}>−{formatNumber(item.usedToday)} {item.unit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ fontWeight: 700, color: '#1A1D23' }}>Remaining</span>
                      <span style={{ fontWeight: 700, color: item.remaining <= 0 ? '#DC2626' : '#1A1D23' }}>{formatNumber(item.remaining)} {item.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          data.usageSummary.length === 0 ? (
            <p style={{ color: '#9CA3AF', margin: 0, fontSize: 14 }}>No usage recorded for this period.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {data.usageSummary.map((item) => (
                <div key={item.ingredientId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #ECEEF5', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{item.name}</span>
                  <strong style={{ color: '#1A1D23' }}>{formatNumber(item.qty)} {item.unit}</strong>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) { resetForm(); setShowModal(false); } }}
        >
          <div
            className="modal"
            style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1A1D23' }}>
                {editingId ? 'Edit Material' : 'Add New Material'}
              </h2>
              <button onClick={() => { resetForm(); setShowModal(false); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Material Name *</label>
                <input placeholder="e.g. Flour" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-input" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Category</label>
                  <input placeholder="e.g. Bakery Raw Material" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-input" style={inputStyle} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="form-select" style={inputStyle}>
                    <option value="">Select unit…</option>
                    {['kg','g','L','ml','pcs','cup','tbsp','tsp','dozen','box','bag','pack','loaf','tray','bottle','litre'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Starting Stock</label>
                  <input type="number" placeholder="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="form-input" style={inputStyle} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Low Stock Alert</label>
                  <input type="number" placeholder="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="form-input" style={inputStyle} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={labelStyle}>Cost Price (per {form.unit || 'unit'})</label>
                <input type="number" placeholder="0.00" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="form-input" style={inputStyle} />
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Used to calculate production cost & profit</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Daily Target</label>
                  <input type="number" placeholder="0" value={form.dailyUsageTarget} onChange={(e) => setForm({ ...form, dailyUsageTarget: e.target.value })} className="form-input" style={inputStyle} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Weekly Target</label>
                  <input type="number" placeholder="0" value={form.weeklyUsageTarget} onChange={(e) => setForm({ ...form, weeklyUsageTarget: e.target.value })} className="form-input" style={inputStyle} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={labelStyle}>Monthly Target</label>
                  <input type="number" placeholder="0" value={form.monthlyUsageTarget} onChange={(e) => setForm({ ...form, monthlyUsageTarget: e.target.value })} className="form-input" style={inputStyle} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={labelStyle}>Supplier</label>
                <input placeholder="Supplier name" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="form-input" style={inputStyle} />
              </div>

              <div className="form-group">
                <label className="form-label" style={labelStyle}>Notes</label>
                <textarea placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="form-input" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #ECEEF5' }}>
              <button onClick={() => { resetForm(); setShowModal(false); }} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : editingId ? 'Update Material' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restock Modal ── */}
      {showRestockModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRestockModal(false); }}
        >
          <div
            className="modal"
            style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1A1D23' }}>Restock Material</h2>
              <button onClick={() => setShowRestockModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Material</label>
                <select value={topup.ingredientId} onChange={(e) => setTopup({ ...topup, ingredientId: e.target.value })} className="form-select form-input" style={inputStyle}>
                  <option value="">Select material</option>
                  {data.ingredients.map((item) => (
                    <option key={item._id} value={item._id}>{item.name} — {item.stock} {item.unit} in stock</option>
                  ))}
                </select>
              </div>
              {topupIngredient && (
                <div style={{ padding: '8px 12px', background: '#DCFCE7', borderRadius: 10, fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                  Current stock: {topupIngredient.stock} {topupIngredient.unit}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Quantity to Add *</label>
                <input type="number" min="0" placeholder="0" value={topup.qty} onChange={(e) => setTopup({ ...topup, qty: e.target.value })} className="form-input" style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Reference / Batch No.</label>
                <input placeholder="Optional" value={topup.reference} onChange={(e) => setTopup({ ...topup, reference: e.target.value })} className="form-input" style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Note</label>
                <textarea placeholder="Optional" value={topup.note} onChange={(e) => setTopup({ ...topup, note: e.target.value })} className="form-input" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #ECEEF5' }}>
              <button onClick={() => setShowRestockModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleTopup} disabled={toppingUp} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: toppingUp ? 0.7 : 1 }}>
                {toppingUp ? 'Saving…' : '+ Top Up Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Usage Modal ── */}
      {showUsageModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUsageModal(false); }}
        >
          <div
            className="modal"
            style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1A1D23' }}>Record Usage</h2>
              <button onClick={() => setShowUsageModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Material</label>
                <select value={movement.ingredientId} onChange={(e) => setMovement({ ...movement, ingredientId: e.target.value })} className="form-select form-input" style={inputStyle}>
                  <option value="">Select material</option>
                  {data.ingredients.map((item) => (
                    <option key={item._id} value={item._id}>{item.name} — {item.stock} {item.unit} in stock</option>
                  ))}
                </select>
              </div>
              {usageIngredient && (
                <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 10, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                  Current stock: {usageIngredient.stock} {usageIngredient.unit}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Type</label>
                <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} className="form-select form-input" style={inputStyle}>
                  <option value="usage">Usage / Consumption</option>
                  <option value="waste">Waste</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Quantity Used *</label>
                <input type="number" min="0" placeholder="0" value={movement.qty} onChange={(e) => setMovement({ ...movement, qty: e.target.value })} className="form-input" style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Note</label>
                <textarea placeholder="Optional" value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })} className="form-input" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #ECEEF5' }}>
              <button onClick={() => setShowUsageModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleMovement} disabled={posting} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: posting ? 0.7 : 1 }}>
                {posting ? 'Saving…' : '− Record Usage'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
