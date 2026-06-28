'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Factory, RotateCcw, Plus, Minus, Trash2, ClipboardList,
  Search, Check, Sun, Package, Pencil, Camera, X, FlaskConical, PlusCircle,
  Wallet, TrendingUp, Coins, Receipt,
} from 'lucide-react';

interface IngLog { _id: string; name: string; qty: number; unit: string }
interface InvIngredient { _id: string; name: string; unit: string; costPrice: number }
interface RecipeRow {
  ingredientId: string;
  qtyPerUnit: number;
  ingredient: { _id: string; name: string; unit: string; costPrice: number };
}
interface ProdItem {
  _id: string;
  name: string;
  unit: string;
  category: string;
  photo: string;
  retailPrice: number;
  wholesalePrice: number;
  recipe: RecipeRow[];
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DailyRecord {
  _id: string;
  item: ProdItem;
  qty: number;
  date: string;
}

interface BatchEntry { item: ProdItem; qty: number }

const PROD_CATEGORIES = ['Bread', 'Cakes', 'Pastries', 'Cookies', 'Savories', 'Beverages', 'Other'];
const UNITS = ['pcs', 'loaves', 'kg', 'g', 'L', 'ml', 'trays', 'bags', 'boxes', 'cups'];

const CAT_COLORS: Record<string, string> = {
  Bread: '#F59E0B', Cakes: '#EC4899', Pastries: '#8B5CF6',
  Cookies: '#F97316', Savories: '#22C55E', Beverages: '#3B82F6', Other: '#94A3B8',
};

function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = 300; canvas.height = 300;
      canvas.getContext('2d')!.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 300, 300);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Thumb({ photo, name, category, size = 48 }: { photo?: string; name: string; category: string; size?: number }) {
  const color = CAT_COLORS[category] ?? '#94A3B8';
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), overflow: 'hidden', flexShrink: 0, position: 'relative', background: color + '20', border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 800, color }}>{name.charAt(0).toUpperCase()}</span>
      {photo && <img src={photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
    </div>
  );
}

const BLANK_FORM = { name: '', unit: 'pcs', category: 'Bread', photo: '', retailPrice: '', wholesalePrice: '' };

export default function ProductionPage() {
  const [items, setItems] = useState<ProdItem[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [ingLogs, setIngLogs] = useState<IngLog[]>([]);
  const [invIngredients, setInvIngredients] = useState<InvIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  const [recording, setRecording] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');

  // Ingredient log form
  const [ingLogName, setIngLogName] = useState('');
  const [ingLogQty, setIngLogQty] = useState('');
  const [ingLogUnit, setIngLogUnit] = useState('kg');
  const [addingLog, setAddingLog] = useState(false);

  // Item modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProdItem | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [recipeRows, setRecipeRows] = useState<{ ingredientId: string; qtyPerUnit: string }[]>([]);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [photoTab, setPhotoTab] = useState<'file' | 'url'>('file');
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const fetchAll = async () => {
    const [iRes, rRes, logRes, invRes] = await Promise.all([
      fetch('/api/production/items'),
      fetch('/api/production/daily'),
      fetch('/api/production/ingredient-log'),
      fetch('/api/inventory'),
    ]);
    setItems(iRes.ok ? await iRes.json() : []);
    setRecords(rRes.ok ? await rRes.json() : []);
    setIngLogs(logRes.ok ? await logRes.json() : []);
    const invData = invRes.ok ? await invRes.json() : {};
    const ings = Array.isArray(invData) ? invData : (invData.ingredients ?? []);
    setInvIngredients(ings.map((i: any) => ({ _id: i._id, name: i.name, unit: i.unit, costPrice: i.costPrice ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── batch ── */
  const addToBatch = (item: ProdItem) => {
    setBatch(prev => {
      const ex = prev.find(b => b.item._id === item._id);
      if (ex) return prev.map(b => b.item._id === item._id ? { ...b, qty: b.qty + 1 } : b);
      return [...prev, { item, qty: 1 }];
    });
  };
  const setBatchQty = (id: string, qty: number) => {
    if (qty <= 0) setBatch(prev => prev.filter(b => b.item._id !== id));
    else setBatch(prev => prev.map(b => b.item._id === id ? { ...b, qty } : b));
  };
  const removeFromBatch = (id: string) => setBatch(prev => prev.filter(b => b.item._id !== id));

  const handleRecord = async () => {
    if (!batch.length) return;
    setRecording(true);
    try {
      await Promise.all(batch.map(e =>
        fetch('/api/production/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: e.item._id, qty: e.qty }),
        })
      ));
      setBatch([]);
      await fetchAll();
    } catch { alert('Failed to record'); }
    finally { setRecording(false); }
  };

  const handleReset = async () => {
    if (!confirm("Clear today's production log and ingredient usage? This starts a fresh day.")) return;
    setResetting(true);
    try {
      await Promise.all([
        fetch('/api/production/daily', { method: 'DELETE' }),
        fetch('/api/production/ingredient-log', { method: 'DELETE' }),
      ]);
      setBatch([]);
      await fetchAll();
    } catch { alert('Failed to reset'); }
    finally { setResetting(false); }
  };

  const handleAddIngLog = async () => {
    if (!ingLogName.trim() || !ingLogQty || parseFloat(ingLogQty) <= 0) return;
    setAddingLog(true);
    try {
      const res = await fetch('/api/production/ingredient-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ingLogName.trim(), qty: parseFloat(ingLogQty), unit: ingLogUnit }),
      });
      if (res.ok) {
        setIngLogName(''); setIngLogQty('');
        await fetchAll();
      }
    } finally { setAddingLog(false); }
  };

  const handleDeleteIngLog = async (id: string) => {
    await fetch(`/api/production/ingredient-log?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  };

  /* ── item modal ── */
  const openAdd = () => {
    setEditingItem(null); setForm(BLANK_FORM); setRecipeRows([]);
    setPhotoPreview(''); setUrlInput(''); setPhotoTab('file');
    setShowModal(true);
  };
  const openEdit = (item: ProdItem) => {
    setEditingItem(item);
    setForm({
      name: item.name, unit: item.unit, category: item.category, photo: item.photo,
      retailPrice: item.retailPrice ? String(item.retailPrice) : '',
      wholesalePrice: item.wholesalePrice ? String(item.wholesalePrice) : '',
    });
    setRecipeRows((item.recipe ?? []).map(r => ({ ingredientId: r.ingredientId, qtyPerUnit: String(r.qtyPerUnit) })));
    setPhotoPreview(item.photo);
    setPhotoTab(item.photo.startsWith('http') ? 'url' : 'file');
    setUrlInput(item.photo.startsWith('http') ? item.photo : '');
    setShowModal(true);
  };

  /* ── recipe editor ── */
  const addRecipeRow = () => setRecipeRows(prev => [...prev, { ingredientId: '', qtyPerUnit: '' }]);
  const updateRecipeRow = (idx: number, patch: Partial<{ ingredientId: string; qtyPerUnit: string }>) =>
    setRecipeRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRecipeRow = (idx: number) => setRecipeRows(prev => prev.filter((_, i) => i !== idx));

  // cost to make one unit, from the recipe currently in the modal
  const recipeUnitCost = recipeRows.reduce((sum, r) => {
    const ing = invIngredients.find(i => i._id === r.ingredientId);
    return sum + (parseFloat(r.qtyPerUnit) || 0) * (ing?.costPrice ?? 0);
  }, 0);

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return; }
    setPhotoUploading(true);
    try {
      const b64 = await cropToSquare(file);
      setPhotoPreview(b64);
      setForm(f => ({ ...f, photo: b64 }));
    } catch { alert('Failed to process image'); }
    finally { setPhotoUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, photo: url }));
    setPhotoPreview(url);
  };

  const handleSaveItem = async () => {
    if (!form.name.trim()) return;
    const finalPhoto = photoTab === 'url' ? (urlInput.trim() || form.photo) : form.photo;
    const recipe = recipeRows
      .filter(r => r.ingredientId && parseFloat(r.qtyPerUnit) > 0)
      .map(r => ({ ingredientId: r.ingredientId, qtyPerUnit: parseFloat(r.qtyPerUnit) }));
    setSaving(true);
    try {
      const res = await fetch('/api/production/items', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingItem ? { _id: editingItem._id } : {}),
          ...form,
          retailPrice: parseFloat(form.retailPrice) || 0,
          wholesalePrice: parseFloat(form.wholesalePrice) || 0,
          photo: finalPhoto,
          recipe,
        }),
      });
      if (res.ok) { setShowModal(false); await fetchAll(); }
      else { const { error } = await res.json().catch(() => ({})); alert(error || 'Save failed'); }
    } finally { setSaving(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this production item?')) return;
    await fetch(`/api/production/items?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  };

  /* ── derived ── */
  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) && (!filterCat || i.category === filterCat)
  );
  const batchMap = Object.fromEntries(batch.map(b => [b.item._id, b.qty]));
  const batchTotal = batch.reduce((s, b) => s + b.qty, 0);
  const todaySummary = records.reduce<Record<string, { name: string; unit: string; qty: number; photo: string }>>((acc, r) => {
    const id = r.item._id;
    if (!acc[id]) acc[id] = { name: r.item.name, unit: r.item.unit, qty: 0, photo: r.item.photo };
    acc[id].qty += r.qty;
    return acc;
  }, {});
  const todayTotal = records.reduce((s, r) => s + r.qty, 0);
  const catCounts = items.reduce<Record<string, number>>((acc, i) => { acc[i.category] = (acc[i.category] ?? 0) + 1; return acc; }, {});

  /* ── cost / revenue / profit ── */
  const itemById = Object.fromEntries(items.map(i => [i._id, i]));

  // Ingredients used today, auto-derived from each item's recipe × qty produced,
  // then merged with any manually-logged extras. Keyed by lowercased name.
  type UsageRow = { name: string; unit: string; qty: number; cost: number; fromRecipe: number; fromManual: number };
  const usageMap: Record<string, UsageRow> = {};
  const addUsage = (name: string, unit: string, qty: number, costPrice: number, kind: 'recipe' | 'manual') => {
    const key = name.trim().toLowerCase();
    if (!usageMap[key]) usageMap[key] = { name, unit, qty: 0, cost: 0, fromRecipe: 0, fromManual: 0 };
    usageMap[key].qty += qty;
    usageMap[key].cost += qty * costPrice;
    usageMap[key][kind === 'recipe' ? 'fromRecipe' : 'fromManual'] += qty;
  };

  Object.entries(todaySummary).forEach(([id, s]) => {
    const item = itemById[id];
    if (!item?.recipe) return;
    item.recipe.forEach(r => {
      addUsage(r.ingredient.name, r.ingredient.unit, r.qtyPerUnit * s.qty, r.ingredient.costPrice ?? 0, 'recipe');
    });
  });
  ingLogs.forEach(log => {
    const inv = invIngredients.find(i => i.name.trim().toLowerCase() === log.name.trim().toLowerCase());
    addUsage(log.name, log.unit, log.qty, inv?.costPrice ?? 0, 'manual');
  });

  const usageRows = Object.values(usageMap).sort((a, b) => b.cost - a.cost);
  const totalIngredientCost = usageRows.reduce((s, u) => s + u.cost, 0);

  const retailRevenue = Object.entries(todaySummary).reduce((s, [id, t]) => s + t.qty * (itemById[id]?.retailPrice ?? 0), 0);
  const wholesaleRevenue = Object.entries(todaySummary).reduce((s, [id, t]) => s + t.qty * (itemById[id]?.wholesalePrice ?? 0), 0);
  const retailProfit = retailRevenue - totalIngredientCost;
  const wholesaleProfit = wholesaleRevenue - totalIngredientCost;
  const hasFinancials = totalIngredientCost > 0 || retailRevenue > 0 || wholesaleRevenue > 0;

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <Factory size={22} color="#2563EB" strokeWidth={2} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Daily Production</h1>
          </div>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2.5} /> Add Item
          </button>
          <button onClick={handleReset} disabled={resetting} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: resetting ? 0.6 : 1 }}>
            <RotateCcw size={14} strokeWidth={2.5} /> {resetting ? 'Resetting…' : 'New Day'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'PRODUCED TODAY', value: todayTotal, sub: `${Object.keys(todaySummary).length} item type${Object.keys(todaySummary).length !== 1 ? 's' : ''}`, icon: <Factory size={16} color="#2563EB" strokeWidth={2} />, bg: '#EFF6FF', valColor: todayTotal > 0 ? '#22C55E' : '#1A1D23' },
          { label: 'IN BATCH', value: batchTotal, sub: `${batch.length} item${batch.length !== 1 ? 's' : ''} queued`, icon: <ClipboardList size={16} color="#F97316" strokeWidth={2} />, bg: '#FFF7ED', valColor: batchTotal > 0 ? '#F97316' : '#1A1D23' },
          { label: 'CATALOG', value: items.length, sub: 'production items', icon: <Package size={16} color="#22C55E" strokeWidth={2} />, bg: '#F0FDF4', valColor: '#1A1D23' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 18, padding: '14px 18px', border: '1px solid #ECEEF5', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.valColor }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* New day banner */}
      {records.length === 0 && batch.length === 0 && items.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sun size={18} color="#F59E0B" strokeWidth={2} />
          <div style={{ fontSize: 13, color: '#92400E' }}>
            <strong>New day</strong> — no production recorded yet. Click items below to build your batch, then click Record.
          </div>
        </div>
      )}

      {items.length === 0 ? (
        /* Empty catalog */
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5' }}>
          <Factory size={44} color="#D1D5DB" strokeWidth={1.2} style={{ margin: '0 auto 14px', display: 'block' }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1D23', marginBottom: 6 }}>No Production Items Yet</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Add the bakery items you produce each day — bread loaves, cake batches, pastries, etc.</div>
          <button onClick={openAdd} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Add First Item
          </button>
        </div>
      ) : (
        /* Main layout */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* ── Left: catalog ── */}
          <div>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
              <button onClick={() => setFilterCat('')} style={{ padding: '7px 14px', borderRadius: 99, border: `2px solid ${filterCat === '' ? '#2563EB' : '#ECEEF5'}`, background: filterCat === '' ? '#EFF6FF' : '#fff', color: filterCat === '' ? '#2563EB' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                All ({items.length})
              </button>
              {PROD_CATEGORIES.filter(c => catCounts[c]).map(cat => {
                const color = CAT_COLORS[cat] ?? '#94A3B8';
                const active = filterCat === cat;
                return (
                  <button key={cat} onClick={() => setFilterCat(active ? '' : cat)} style={{ padding: '7px 14px', borderRadius: 99, border: `2px solid ${active ? color : '#ECEEF5'}`, background: active ? color + '18' : '#fff', color: active ? color : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {cat} ({catCounts[cat]})
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="text" placeholder="Search production items…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 14px 9px 36px', borderRadius: 12, border: '1.5px solid #ECEEF5', background: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Item cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
              {filtered.map(item => {
                const inBatch = batchMap[item._id] ?? 0;
                const color = CAT_COLORS[item.category] ?? '#94A3B8';
                return (
                  <div key={item._id} onClick={() => addToBatch(item)} style={{ background: '#fff', borderRadius: 16, border: `2px solid ${inBatch ? '#2563EB' : '#ECEEF5'}`, cursor: 'pointer', overflow: 'hidden', boxShadow: inBatch ? '0 0 0 3px rgba(37,99,235,0.10)' : '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.15s', position: 'relative' }}>
                    {/* Photo */}
                    <div style={{ height: 100, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color }}>{item.name.charAt(0).toUpperCase()}</span>
                      {item.photo && <img src={item.photo} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
                      {inBatch > 0 && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {inBatch}
                        </div>
                      )}
                      {/* Edit / delete buttons */}
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(item)} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.88)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Pencil size={10} color="#2563EB" strokeWidth={2.5} />
                        </button>
                        <button onClick={() => handleDeleteItem(item._id)} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.88)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={10} color="#EF4444" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '9px 10px 10px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '18', borderRadius: 99, padding: '2px 7px' }}>{item.category}</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{item.unit}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Today's batch */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1D23' }}>Today's Batch</div>
                {batch.length > 0 && <button onClick={() => setBatch([])} style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>}
              </div>
              {batch.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF' }}>
                  <ClipboardList size={28} color="#E5E7EB" strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Click items to add</div>
                </div>
              ) : (
                <div>
                  {batch.map(e => (
                    <div key={e.item._id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderBottom: '1px solid #F9FAFB' }}>
                      <Thumb photo={e.item.photo} name={e.item.name} category={e.item.category} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.item.name}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{e.item.unit}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <button onClick={() => setBatchQty(e.item._id, e.qty - 1)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Minus size={10} color="#6B7280" />
                        </button>
                        <input type="number" min="1" value={e.qty} onChange={ev => setBatchQty(e.item._id, parseInt(ev.target.value) || 1)}
                          style={{ width: 58, textAlign: 'center', border: '1.5px solid #ECEEF5', borderRadius: 7, padding: '2px 4px', fontSize: 13, fontWeight: 700, color: '#1A1D23', outline: 'none' }} />
                        <button onClick={() => setBatchQty(e.item._id, e.qty + 1)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={10} color="#6B7280" />
                        </button>
                        <button onClick={() => removeFromBatch(e.item._id)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>
                          <Trash2 size={9} color="#EF4444" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', background: '#FAFBFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 9 }}>
                      <span>{batch.length} item{batch.length !== 1 ? 's' : ''}</span>
                      <span style={{ fontWeight: 700, color: '#1A1D23' }}>{batchTotal} units</span>
                    </div>
                    <button onClick={handleRecord} disabled={recording} style={{ width: '100%', padding: '10px', borderRadius: 11, border: 'none', background: recording ? '#93C5FD' : '#2563EB', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <Check size={14} strokeWidth={2.5} /> {recording ? 'Recording…' : 'Record Production'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recorded today */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1D23' }}>Recorded Today</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', borderRadius: 99, padding: '2px 8px' }}>{todayTotal} units</span>
              </div>
              {Object.keys(todaySummary).length === 0 ? (
                <div style={{ padding: '18px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Nothing recorded yet</div>
              ) : (
                Object.entries(todaySummary).map(([id, s]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderBottom: '1px solid #F9FAFB' }}>
                    <Thumb photo={s.photo} name={s.name} category={items.find(i => i._id === id)?.category ?? 'Other'} size={30} />
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>+{s.qty}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{s.unit}</span>
                  </div>
                ))
              )}
            </div>

            {/* Cost & Profit */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Coins size={15} color="#0EA5E9" strokeWidth={2} />
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1D23', flex: 1 }}>Cost & Profit</div>
              </div>
              {!hasFinancials ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                  Set ingredient cost prices and item selling prices to see today's real cost & profit.
                </div>
              ) : (
                <div style={{ padding: '12px 14px' }}>
                  {/* Real cost */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                      <Wallet size={14} color="#7C3AED" /> Real cost (ingredients)
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#7C3AED' }}>{formatLKR(totalIngredientCost)}</span>
                  </div>
                  {/* Retail */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Retail revenue</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>{formatLKR(retailRevenue)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                        <TrendingUp size={13} color={retailProfit >= 0 ? '#22C55E' : '#EF4444'} /> Retail profit
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: retailProfit >= 0 ? '#22C55E' : '#EF4444' }}>{formatLKR(retailProfit)}</span>
                    </div>
                  </div>
                  {/* Wholesale */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Wholesale revenue</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>{formatLKR(wholesaleRevenue)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                        <TrendingUp size={13} color={wholesaleProfit >= 0 ? '#22C55E' : '#EF4444'} /> Wholesale profit
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: wholesaleProfit >= 0 ? '#22C55E' : '#EF4444' }}>{formatLKR(wholesaleProfit)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ingredients Used Today */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={15} color="#7C3AED" strokeWidth={2} />
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1D23', flex: 1 }}>Ingredients Used Today</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', borderRadius: 99, padding: '2px 8px' }}>{usageRows.length}</span>
              </div>
              {/* Log entry form */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', background: '#FAFBFF' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {invIngredients.length === 0 ? (
                    <input
                      type="text" placeholder="Ingredient name" value={ingLogName}
                      onChange={e => setIngLogName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddIngLog()}
                      style={{ flex: 1, padding: '6px 9px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none' }}
                    />
                  ) : (
                    <select
                      value={ingLogName}
                      onChange={e => {
                        const selected = invIngredients.find(i => i.name === e.target.value);
                        setIngLogName(e.target.value);
                        if (selected) setIngLogUnit(selected.unit);
                      }}
                      style={{ flex: 1, padding: '6px 9px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', background: '#fff', color: ingLogName ? '#1A1D23' : '#9CA3AF' }}
                    >
                      <option value="">Select ingredient…</option>
                      {invIngredients.map(i => <option key={i._id} value={i.name}>{i.name}</option>)}
                    </select>
                  )}
                  <input
                    type="number" placeholder="Qty" min="0.01" step="0.01" value={ingLogQty}
                    onChange={e => setIngLogQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddIngLog()}
                    style={{ width: 58, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none' }}
                  />
                  <select value={ingLogUnit} onChange={e => setIngLogUnit(e.target.value)}
                    style={{ width: 70, padding: '6px 4px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', background: '#fff' }}>
                    {['kg','g','L','ml','pcs','cup','tbsp','tsp','dozen','box','bag','loaf','tray'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={handleAddIngLog} disabled={addingLog || !ingLogName.trim() || !ingLogQty}
                    style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (!ingLogName.trim() || !ingLogQty) ? 0.4 : 1 }}>
                    <PlusCircle size={15} strokeWidth={2.5} />
                  </button>
                </div>
                {invIngredients.length === 0 && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                    Add ingredients in the Inventory page to get a dropdown here
                  </div>
                )}
              </div>
              {usageRows.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                  Record production to auto-calculate usage, or log extra ingredients above
                </div>
              ) : (
                usageRows.map(u => (
                  <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #F9FAFB' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FlaskConical size={13} color="#7C3AED" strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      {u.fromManual > 0 && u.fromRecipe > 0 && (
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>recipe + extra</div>
                      )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#7C3AED' }}>
                      {u.qty % 1 === 0 ? u.qty : u.qty.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', width: 28 }}>{u.unit}</span>
                    {u.cost > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0EA5E9', background: '#E0F2FE', borderRadius: 6, padding: '2px 6px' }}>
                        {formatLKR(u.cost)}
                      </span>
                    )}
                    {u.fromManual > 0 && (
                      <button onClick={() => {
                        const log = ingLogs.find(l => l.name.trim().toLowerCase() === u.name.trim().toLowerCase());
                        if (log) handleDeleteIngLog(log._id);
                      }}
                        style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={9} color="#EF4444" />
                      </button>
                    )}
                  </div>
                ))
              )}
              {totalIngredientCost > 0 && (
                <div style={{ padding: '10px 14px', background: '#FAFBFF', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Total ingredient cost</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#7C3AED' }}>{formatLKR(totalIngredientCost)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Item' : 'Add Production Item'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* Photo */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Photo (optional)</label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Preview */}
                  <div onClick={() => photoTab === 'file' && !photoUploading && fileRef.current?.click()}
                    style={{ width: 90, height: 90, borderRadius: 14, border: `2px dashed ${photoPreview ? '#2563EB' : '#D1D5DB'}`, background: photoPreview ? 'transparent' : '#F8F9FF', overflow: 'hidden', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: photoTab === 'file' ? 'pointer' : 'default' }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <><Camera size={22} color="#D1D5DB" strokeWidth={1.5} style={{ display: 'block' }} /><span style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3 }}>Photo</span></>}
                    {photoUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 20, height: 20 }} /></div>}
                  </div>
                  {/* Controls */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 8, background: '#F3F4F6', borderRadius: 8, padding: 2, width: 'fit-content' }}>
                      {(['file', 'url'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setPhotoTab(t)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: photoTab === t ? '#fff' : 'transparent', color: photoTab === t ? '#2563EB' : '#6B7280', boxShadow: photoTab === t ? '0 1px 3px rgba(0,0,0,0.10)' : 'none' }}>
                          {t === 'file' ? 'Upload' : 'URL'}
                        </button>
                      ))}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />
                    {photoTab === 'file'
                      ? <button type="button" onClick={() => fileRef.current?.click()} disabled={photoUploading} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px dashed #D1D5DB', background: '#F8F9FF', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 600 }}>{photoUploading ? 'Processing…' : 'Choose image (max 2MB)'}</button>
                      : <div style={{ display: 'flex', gap: 5 }}>
                          <input className="form-input" type="url" placeholder="https://…" value={urlInput} onChange={e => setUrlInput(e.target.value)} onBlur={applyUrl} onKeyDown={e => e.key === 'Enter' && applyUrl()} style={{ flex: 1, fontSize: 12 }} />
                          <button type="button" onClick={applyUrl} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Apply</button>
                        </div>
                    }
                    {photoPreview && <button type="button" onClick={() => { setPhotoPreview(''); setUrlInput(''); setForm(f => ({ ...f, photo: '' })); }} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}><X size={11} /> Remove</button>}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Item Name</label>
                <input className="form-input" type="text" placeholder="e.g. Butter Bread Loaf" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {PROD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Selling prices */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Retail Price (LKR)</label>
                  <input className="form-input" type="number" placeholder="0.00" step="0.01" value={form.retailPrice}
                    onChange={e => setForm({ ...form, retailPrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wholesale Price (LKR)</label>
                  <input className="form-input" type="number" placeholder="0.00" step="0.01" value={form.wholesalePrice}
                    onChange={e => setForm({ ...form, wholesalePrice: e.target.value })} />
                </div>
              </div>

              {/* Recipe */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>Recipe (per {form.unit})</label>
                  <button type="button" onClick={addRecipeRow}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                    <Plus size={11} strokeWidth={2.5} /> Add ingredient
                  </button>
                </div>
                {recipeRows.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9CA3AF', padding: '8px 0' }}>
                    Optional — add ingredients to auto-calculate cost &amp; ingredient usage.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recipeRows.map((r, idx) => {
                      const selIng = invIngredients.find(i => i._id === r.ingredientId);
                      const rowCost = selIng ? (parseFloat(r.qtyPerUnit) || 0) * selIng.costPrice : 0;
                      return (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select value={r.ingredientId}
                            onChange={e => updateRecipeRow(idx, { ingredientId: e.target.value })}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', background: '#fff' }}>
                            <option value="">Select ingredient…</option>
                            {invIngredients.map(i => <option key={i._id} value={i._id}>{i.name} ({i.unit})</option>)}
                          </select>
                          <input type="number" placeholder="Qty" min="0.001" step="0.001" value={r.qtyPerUnit}
                            onChange={e => updateRecipeRow(idx, { qtyPerUnit: e.target.value })}
                            style={{ width: 58, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none' }} />
                          {selIng && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {selIng.unit}
                            </span>
                          )}
                          {rowCost > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#0EA5E9', background: '#E0F2FE', borderRadius: 6, padding: '3px 6px', whiteSpace: 'nowrap' }}>
                              {formatLKR(rowCost)}
                            </span>
                          )}
                          <button type="button" onClick={() => removeRecipeRow(idx)}
                            style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <X size={10} color="#EF4444" />
                          </button>
                        </div>
                      );
                    })}
                    {recipeUnitCost > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', borderRadius: 8, padding: '6px 10px', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cost per {form.unit}</span>
                        <span>{formatLKR(recipeUnitCost)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveItem} disabled={!form.name.trim() || saving}>
                {saving ? 'Saving…' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
