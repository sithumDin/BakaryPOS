'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Package, AlertTriangle, DollarSign, Tag, Pencil, Trash2, Camera, X } from 'lucide-react';

/* Crop image file to a centered square, resize to 300×300, return base64 JPEG */
function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}
import { Product, CATEGORIES, UNITS } from '@/lib/types';

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRetailPrice(product: Product) {
  return product.retailPrice ?? product.sellingPrice ?? 0;
}

function getWholesalePrice(product: Product) {
  return product.wholesalePrice ?? product.sellingPrice ?? 0;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Bread': '#F59E0B',
  'Cakes': '#EC4899',
  'Pastries': '#8B5CF6',
  'Cookies & Biscuits': '#F97316',
  'Rolls & Buns': '#EAB308',
  'Savories': '#22C55E',
  'Beverages': '#3B82F6',
  'Other': '#94A3B8',
};

/* Fixed-size product thumbnail — same dimensions everywhere */
function ProductThumb({ photo, name, category }: { photo?: string; name: string; category: string }) {
  const color = CATEGORY_COLORS[category] ?? '#94A3B8';
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '1.5px solid #ECEEF5', display: 'block', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
      background: `${color}20`, border: `1.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800, color, fontFamily: 'sans-serif',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [topupProduct, setTopupProduct] = useState<Product | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoTab, setPhotoTab] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'Bread',
    costPrice: '',
    retailPrice: '',
    wholesalePrice: '',
    stock: '',
    unit: 'pcs',
    lowStockThreshold: '10',
    photo: '',
  });

  const fetchProducts = () => {
    fetch('/api/products')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', category: 'Bread', costPrice: '', retailPrice: '', wholesalePrice: '', stock: '', unit: 'pcs', lowStockThreshold: '10', photo: '' });
    setPhotoPreview('');
    setPhotoTab('file');
    setUrlInput('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const photo = p.photo || '';
    setForm({
      name: p.name,
      category: p.category,
      costPrice: String(p.costPrice),
      retailPrice: String(getRetailPrice(p)),
      wholesalePrice: String(getWholesalePrice(p)),
      stock: String(p.stock),
      unit: p.unit,
      lowStockThreshold: String(p.lowStockThreshold),
      photo,
    });
    setPhotoPreview(photo);
    setPhotoTab(photo.startsWith('http') ? 'url' : 'file');
    setUrlInput(photo.startsWith('http') ? photo : '');
    setShowModal(true);
  };

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, photo: url }));
    setPhotoPreview(url);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }

    setPhotoUploading(true);
    try {
      const base64 = await cropToSquare(file);
      setPhotoPreview(base64);
      setForm(f => ({ ...f, photo: base64 }));
    } catch {
      alert('Failed to process image');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // If user typed a URL but forgot to click Apply, use it anyway
    const finalPhoto = photoTab === 'url' ? (urlInput.trim() || form.photo) : form.photo;
    const data = {
      ...(editing ? { _id: editing._id } : {}),
      name: form.name,
      category: form.category,
      costPrice: parseFloat(form.costPrice) || 0,
      retailPrice: parseFloat(form.retailPrice) || 0,
      wholesalePrice: parseFloat(form.wholesalePrice) || 0,
      stock: parseFloat(form.stock) || 0,
      unit: form.unit,
      lowStockThreshold: parseFloat(form.lowStockThreshold) || 10,
      photo: finalPhoto,
    };

    const res = await fetch('/api/products', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowModal(false);
      fetchProducts();
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      alert(`Error saving product: ${error || 'Unknown error'}`);
    }
  };

  const openTopup = (p: Product) => { setTopupProduct(p); setTopupAmount(''); };

  const handleTopup = async () => {
    if (!topupProduct) return;
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) return;
    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: topupProduct._id, topup: amount }),
    });
    if (res.ok) { setTopupProduct(null); fetchProducts(); }
    else { const { error } = await res.json().catch(() => ({ error: 'Unknown error' })); alert(`Top up failed: ${error}`); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) && (!filterCategory || p.category === filterCategory)
  );

  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const uniqueCategories = new Set(products.map((p) => p.category)).size;

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Products</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Manage your bakery product catalog</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 99, background: '#fff', border: '1.5px solid #ECEEF5', fontSize: 14, color: '#1A1D23', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select className="form-select" style={{ width: 160, borderRadius: 12 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={19} color="#2563EB" strokeWidth={1.8} /></div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Total Products</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1D23' }}>{products.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={19} color="#F97316" strokeWidth={1.8} /></div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Low Stock</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: lowStockCount > 0 ? '#EF4444' : '#1A1D23' }}>{lowStockCount}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={19} color="#16A34A" strokeWidth={1.8} /></div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Total Value</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1D23' }}>{formatLKR(totalValue)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tag size={19} color="#7C3AED" strokeWidth={1.8} /></div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Categories</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1D23' }}>{uniqueCategories}</div>
        </div>
      </div>

      {/* Products table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Package size={40} color="#9CA3AF" strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
          <h3>No Products Found</h3>
          <p>Add your first product to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 72 }}>Photo</th>
                <th>Product</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Retail</th>
                <th style={{ textAlign: 'right' }}>Wholesale</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const retailPrice = getRetailPrice(p);
                const wholesalePrice = getWholesalePrice(p);
                const isLow = p.stock <= p.lowStockThreshold;
                const catColor = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS['Other'];
                return (
                  <tr key={p._id}>
                    <td style={{ padding: '10px 16px' }}>
                      <ProductThumb photo={p.photo} name={p.name} category={p.category} />
                    </td>
                    <td style={{ fontWeight: 600, color: '#1A1D23' }}>{p.name}</td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: catColor + '20', color: catColor }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#6B7280', fontSize: 13 }}>{formatLKR(p.costPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#22C55E' }}>{formatLKR(retailPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{formatLKR(wholesalePrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#1A1D23' }}>{p.stock} {p.unit}</td>
                    <td>
                      {p.stock === 0 ? <span className="badge badge-danger">Out of Stock</span>
                        : isLow ? <span className="badge badge-danger">Low Stock</span>
                        : <span className="badge badge-success">In Stock</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button title="Top Up Stock" onClick={() => openTopup(p)}
                          style={{ padding: '5px 10px', borderRadius: 9, border: '1.5px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontSize: 13, color: '#16A34A', fontWeight: 700 }}>
                          +
                        </button>
                        <button title="Edit" onClick={() => openEdit(p)}
                          style={{ padding: '6px 9px', borderRadius: 9, border: '1.5px solid #BFDBFE', background: '#EFF6FF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={13} color="#2563EB" strokeWidth={2} />
                        </button>
                        <button title="Delete" onClick={() => handleDelete(p._id!)}
                          style={{ padding: '6px 9px', borderRadius: 9, border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={13} color="#DC2626" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Up Modal */}
      {topupProduct && (
        <div className="modal-overlay" onClick={() => setTopupProduct(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Top Up Stock</h2>
              <button className="modal-close" onClick={() => setTopupProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, color: '#6B7280' }}>
                Adding stock for <strong style={{ color: '#1A1D23' }}>{topupProduct.name}</strong>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: '#F8F9FF', borderRadius: 12, fontSize: 14, flexWrap: 'wrap' }}>
                <span>Current: <strong>{topupProduct.stock} {topupProduct.unit}</strong></span>
                <span style={{ color: '#9CA3AF' }}>+</span>
                <span style={{ color: '#22C55E' }}>Adding: <strong>{parseFloat(topupAmount) || 0} {topupProduct.unit}</strong></span>
                <span style={{ color: '#9CA3AF' }}>=</span>
                <span style={{ color: '#F59E0B' }}>New: <strong>{topupProduct.stock + (parseFloat(topupAmount) || 0)} {topupProduct.unit}</strong></span>
              </div>
              <div className="form-group">
                <label className="form-label">Top Up Amount</label>
                <input className="form-input" type="number" min="1" placeholder="Enter quantity to add" value={topupAmount} autoFocus
                  onChange={(e) => setTopupAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTopup()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTopupProduct(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleTopup} disabled={!topupAmount || parseFloat(topupAmount) <= 0}>Top Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* Photo section */}
              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Product Photo</label>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#F3F4F6', borderRadius: 10, padding: 3, width: 'fit-content' }}>
                  {(['file', 'url'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setPhotoTab(t)} style={{
                      padding: '5px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      background: photoTab === t ? '#fff' : 'transparent',
                      color: photoTab === t ? '#2563EB' : '#6B7280',
                      boxShadow: photoTab === t ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                      {t === 'file' ? 'Upload File' : 'Paste URL'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Preview square */}
                  <div style={{
                    width: 110, height: 110, borderRadius: 14, flexShrink: 0,
                    border: `2px dashed ${photoPreview ? '#2563EB' : '#D1D5DB'}`,
                    background: photoPreview ? 'transparent' : '#F8F9FF',
                    overflow: 'hidden', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: photoTab === 'file' && !photoUploading ? 'pointer' : 'default',
                  }}
                    onClick={() => photoTab === 'file' && !photoUploading && fileInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                        <Camera size={24} strokeWidth={1.5} style={{ margin: '0 auto 4px', display: 'block' }} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>Preview</span>
                      </div>
                    )}
                    {photoUploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner" style={{ width: 22, height: 22 }} />
                      </div>
                    )}
                  </div>

                  {/* Right side controls */}
                  <div style={{ flex: 1 }}>
                    {photoTab === 'file' ? (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px dashed #D1D5DB', background: '#F8F9FF', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600, textAlign: 'left' }}>
                          {photoUploading ? 'Processing…' : 'Click to choose image'}
                        </button>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                          JPG, PNG or WebP · max 2MB<br />Auto-cropped &amp; resized to 300×300
                        </p>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="form-input"
                            type="url"
                            placeholder="https://example.com/photo.jpg"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onBlur={applyUrl}
                            onKeyDown={(e) => e.key === 'Enter' && applyUrl()}
                            style={{ flex: 1, fontSize: 13 }}
                          />
                          <button type="button" onClick={applyUrl}
                            style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Apply
                          </button>
                        </div>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                          Paste a direct image URL and click Apply
                        </p>
                      </>
                    )}

                    {photoPreview && (
                      <button type="button"
                        onClick={() => { setPhotoPreview(''); setUrlInput(''); setForm(f => ({ ...f, photo: '' })); }}
                        style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        <X size={12} /> Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input className="form-input" type="text" placeholder="e.g., Butter Bun"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Cost Price (LKR)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Retail Price (LKR)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Wholesale Price (LKR)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
                </div>
                <div className="form-group" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input className="form-input" type="number" placeholder="0"
                    value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Alert</label>
                  <input className="form-input" type="number" placeholder="10"
                    value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
                </div>
              </div>
              {form.costPrice && form.retailPrice && (
                <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 12, fontSize: 13, color: '#16A34A' }}>
                  Retail profit per unit: <strong>{formatLKR(parseFloat(form.retailPrice) - parseFloat(form.costPrice))}</strong>
                  {' '}({((parseFloat(form.retailPrice) - parseFloat(form.costPrice)) / parseFloat(form.retailPrice) * 100).toFixed(1)}% margin)
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.name || photoUploading}>
                {editing ? 'Update' : 'Add'} Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
