'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Factory, RotateCcw, Plus, Minus, Trash2, ClipboardList,
  Search, Check, Sun, Package, Pencil, Camera, X, FlaskConical,
} from 'lucide-react';

interface Ingredient { _id: string; name: string; unit: string; stock: number }
interface RecipeLine { ingredientId: string; ingredientName: string; ingredientUnit: string; qtyPerUnit: number }
interface ProdItem {
  _id: string;
  name: string;
  unit: string;
  category: string;
  photo: string;
  recipe?: RecipeLine[];
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

const BLANK_FORM = { name: '', unit: 'pcs', category: 'Bread', photo: '' };

export default function ProductionPage() {
  const [items, setItems] = useState<ProdItem[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  const [recording, setRecording] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');

  // Item modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProdItem | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [photoTab, setPhotoTab] = useState<'file' | 'url'>('file');
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  // Recipe lines in modal
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [recipeIngId, setRecipeIngId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');

  const today = new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const fetchAll = async () => {
    const [iRes, rRes, ingRes] = await Promise.all([
      fetch('/api/production/items'),
      fetch('/api/production/daily'),
      fetch('/api/inventory'),
    ]);
    const itemData = iRes.ok ? await iRes.json() : [];
    // flatten recipe from Prisma shape → RecipeLine[]
    setItems(itemData.map((it: any) => ({
      ...it,
      recipe: (it.recipe ?? []).map((r: any) => ({
        ingredientId: r.ingredient?._id ?? r.ingredientId,
        ingredientName: r.ingredient?.name ?? '',
        ingredientUnit: r.ingredient?.unit ?? '',
        qtyPerUnit: r.qtyPerUnit,
      })),
    })));
    const recData = rRes.ok ? await rRes.json() : [];
    setRecords(recData.map((r: any) => ({
      ...r,
      item: {
        ...r.item,
        recipe: (r.item?.recipe ?? []).map((ri: any) => ({
          ingredientId: ri.ingredient?._id ?? ri.ingredientId,
          ingredientName: ri.ingredient?.name ?? '',
          ingredientUnit: ri.ingredient?.unit ?? '',
          qtyPerUnit: ri.qtyPerUnit,
        })),
      },
    })));
    const ingData = ingRes.ok ? await ingRes.json() : {};
    setIngredients(Array.isArray(ingData) ? ingData : (ingData.ingredients ?? []));
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
    if (!confirm("Clear today's production log and start fresh?")) return;
    setResetting(true);
    try {
      await fetch('/api/production/daily', { method: 'DELETE' });
      setBatch([]);
      await fetchAll();
    } catch { alert('Failed to reset'); }
    finally { setResetting(false); }
  };

  /* ── item modal ── */
  const openAdd = () => {
    setEditingItem(null); setForm(BLANK_FORM);
    setPhotoPreview(''); setUrlInput(''); setPhotoTab('file');
    setRecipe([]); setRecipeIngId(''); setRecipeQty('');
    setShowModal(true);
  };
  const openEdit = (item: ProdItem) => {
    setEditingItem(item);
    setForm({ name: item.name, unit: item.unit, category: item.category, photo: item.photo });
    setPhotoPreview(item.photo);
    setPhotoTab(item.photo.startsWith('http') ? 'url' : 'file');
    setUrlInput(item.photo.startsWith('http') ? item.photo : '');
    setRecipe(item.recipe ?? []);
    setRecipeIngId(''); setRecipeQty('');
    setShowModal(true);
  };

  const addRecipeLine = () => {
    const ing = ingredients.find(i => i._id === recipeIngId);
    if (!ing || !recipeQty || parseFloat(recipeQty) <= 0) return;
    if (recipe.find(r => r.ingredientId === recipeIngId)) {
      setRecipe(prev => prev.map(r => r.ingredientId === recipeIngId ? { ...r, qtyPerUnit: parseFloat(recipeQty) } : r));
    } else {
      setRecipe(prev => [...prev, { ingredientId: ing._id, ingredientName: ing.name, ingredientUnit: ing.unit, qtyPerUnit: parseFloat(recipeQty) }]);
    }
    setRecipeIngId(''); setRecipeQty('');
  };
  const removeRecipeLine = (id: string) => setRecipe(prev => prev.filter(r => r.ingredientId !== id));

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
    setSaving(true);
    try {
      const res = await fetch('/api/production/items', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingItem ? { _id: editingItem._id } : {}),
          ...form, photo: finalPhoto,
          recipe: recipe.map(r => ({ ingredientId: r.ingredientId, qtyPerUnit: r.qtyPerUnit })),
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

  // Total ingredient usage from all today's records
  const ingredientUsage = records.reduce<Record<string, { name: string; unit: string; qty: number }>>((acc, r) => {
    for (const line of r.item.recipe ?? []) {
      const total = line.qtyPerUnit * r.qty;
      if (!acc[line.ingredientId]) acc[line.ingredientId] = { name: line.ingredientName, unit: line.ingredientUnit, qty: 0 };
      acc[line.ingredientId].qty += total;
    }
    return acc;
  }, {});
  const catCounts = items.reduce<Record<string, number>>((acc, i) => { acc[i.category] = (acc[i.category] ?? 0) + 1; return acc; }, {});

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

            {/* Ingredient usage */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={15} color="#7C3AED" strokeWidth={2} />
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1D23' }}>Ingredients Used Today</div>
              </div>
              {Object.keys(ingredientUsage).length === 0 ? (
                <div style={{ padding: '14px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                  {records.length === 0 ? 'No production recorded yet' : 'No recipes set — add ingredients to each item'}
                </div>
              ) : (
                Object.entries(ingredientUsage).map(([id, u]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderBottom: '1px solid #F9FAFB' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FlaskConical size={14} color="#7C3AED" strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>{u.name}</div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>{u.qty % 1 === 0 ? u.qty : u.qty.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{u.unit}</span>
                  </div>
                ))
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
            </div>

              {/* Recipe / ingredients */}
              <div style={{ marginTop: 4 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <FlaskConical size={13} color="#7C3AED" strokeWidth={2} /> Ingredients per unit (optional)
                </label>
                {ingredients.length === 0 ? (
                  <div style={{ padding: '10px 12px', background: '#F5F3FF', borderRadius: 10, fontSize: 12, color: '#7C3AED' }}>
                    No inventory ingredients yet — add them in the Inventory page first.
                  </div>
                ) : (
                  <>
                    {recipe.length > 0 && (
                      <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {recipe.map(r => (
                          <div key={r.ingredientId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#F5F3FF', borderRadius: 9 }}>
                            <FlaskConical size={12} color="#7C3AED" strokeWidth={2} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1A1D23' }}>{r.ingredientName}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>{r.qtyPerUnit} {r.ingredientUnit} / {form.unit}</span>
                            <button type="button" onClick={() => removeRecipeLine(r.ingredientId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <X size={13} color="#EF4444" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={recipeIngId} onChange={e => setRecipeIngId(e.target.value)} className="form-select" style={{ flex: 1, fontSize: 12 }}>
                        <option value="">Select ingredient…</option>
                        {ingredients.map(i => <option key={i._id} value={i._id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" step="0.01" min="0.01" placeholder="Qty" value={recipeQty} onChange={e => setRecipeQty(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addRecipeLine()}
                        className="form-input" style={{ width: 70, fontSize: 12 }} />
                      <button type="button" onClick={addRecipeLine} disabled={!recipeIngId || !recipeQty}
                        style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </>
                )}
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
