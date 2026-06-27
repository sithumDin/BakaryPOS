'use client';

import { useEffect, useState } from 'react';
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [topupProduct, setTopupProduct] = useState<Product | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Bread',
    costPrice: '',
    retailPrice: '',
    wholesalePrice: '',
    stock: '',
    unit: 'pcs',
    lowStockThreshold: '10',
  });

  const fetchProducts = () => {
    fetch('/api/products')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch products');
        return r.json();
      })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error(e);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', category: 'Bread', costPrice: '', retailPrice: '', wholesalePrice: '', stock: '', unit: 'pcs', lowStockThreshold: '10' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      costPrice: String(p.costPrice),
      retailPrice: String(getRetailPrice(p)),
      wholesalePrice: String(getWholesalePrice(p)),
      stock: String(p.stock),
      unit: p.unit,
      lowStockThreshold: String(p.lowStockThreshold),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
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
      const { error } = await res.json().catch(() => ({ error: 'Failed to connect to database' }));
      alert(`Error saving product: ${error || 'Unknown error'}. Did you add your MONGODB_URI to .env.local?`);
    }
  };

  const openTopup = (p: Product) => {
    setTopupProduct(p);
    setTopupAmount('');
  };

  const handleTopup = async () => {
    if (!topupProduct) return;
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) return;
    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: topupProduct._id, topup: amount }),
    });
    if (res.ok) {
      setTopupProduct(null);
      fetchProducts();
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      alert(`Top up failed: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // Stat card computed values
  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const uniqueCategories = new Set(products.map((p) => p.category)).size;

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Products</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Manage your bakery product catalog</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: 99,
              background: '#fff',
              border: '1.5px solid #ECEEF5',
              fontSize: 14,
              color: '#1A1D23',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          className="form-select"
          style={{ width: 160, borderRadius: 12 }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Total Products */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Total Products</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1D23' }}>{products.length}</div>
        </div>

        {/* Low Stock */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Low Stock</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: lowStockCount > 0 ? '#EF4444' : '#1A1D23' }}>{lowStockCount}</div>
        </div>

        {/* Total Value */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Total Value</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1D23' }}>{formatLKR(totalValue)}</div>
        </div>

        {/* Categories */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em' }}>Categories</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1D23' }}>{uniqueCategories}</div>
        </div>
      </div>

      {/* Products table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📦</span>
          <h3>No Products Found</h3>
          <p>Add your first product to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
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
              {filtered.map((p, idx) => {
                const retailPrice = getRetailPrice(p);
                const wholesalePrice = getWholesalePrice(p);
                const isLow = p.stock <= p.lowStockThreshold;
                const catColor = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS['Other'];
                return (
                  <tr key={p._id}>
                    <td style={{ color: '#9CA3AF', fontSize: 13 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#1A1D23' }}>{p.name}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 700,
                        background: catColor + '20',
                        color: catColor,
                      }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#6B7280', fontSize: 13 }}>{formatLKR(p.costPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#22C55E' }}>{formatLKR(retailPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{formatLKR(wholesalePrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#1A1D23' }}>
                      {p.stock} {p.unit}
                    </td>
                    <td>
                      {p.stock === 0 ? (
                        <span className="badge badge-danger">Out of Stock</span>
                      ) : isLow ? (
                        <span className="badge badge-danger">Low Stock</span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          title="Top Up Stock"
                          onClick={() => openTopup(p)}
                          style={{ padding: '5px 9px', borderRadius: 9, border: '1.5px solid #ECEEF5', background: '#F0FDF4', cursor: 'pointer', fontSize: 13, color: '#22C55E', fontWeight: 700 }}
                        >
                          +
                        </button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(p)}
                          style={{ padding: '5px 9px', borderRadius: 9, border: '1.5px solid #ECEEF5', background: '#F8F9FF', cursor: 'pointer', fontSize: 13 }}
                        >
                          ✏️
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(p._id!)}
                          style={{ padding: '5px 9px', borderRadius: 9, border: '1.5px solid #ECEEF5', background: '#F8F9FF', cursor: 'pointer', fontSize: 13 }}
                        >
                          🗑️
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
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  placeholder="Enter quantity to add"
                  value={topupAmount}
                  autoFocus
                  onChange={(e) => setTopupAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTopup()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTopupProduct(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleTopup} disabled={!topupAmount || parseFloat(topupAmount) <= 0}>
                Top Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g., Butter Bun"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Cost Price (LKR)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Retail Price (LKR)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.retailPrice}
                    onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Wholesale Price (LKR)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.wholesalePrice}
                    onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
                  />
                </div>
                <div className="form-group" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Alert</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="10"
                    value={form.lowStockThreshold}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                  />
                </div>
              </div>
              {form.costPrice && form.retailPrice && (
                <div style={{
                  padding: '12px 16px',
                  background: '#F0FDF4',
                  borderRadius: 12,
                  fontSize: 13,
                  color: '#16A34A',
                }}>
                  💰 Retail profit per unit: <strong>{formatLKR(parseFloat(form.retailPrice) - parseFloat(form.costPrice))}</strong>
                  {' '}({((parseFloat(form.retailPrice) - parseFloat(form.costPrice)) / parseFloat(form.retailPrice) * 100).toFixed(1)}% margin)
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.name}>
                {editing ? 'Update' : 'Add'} Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
