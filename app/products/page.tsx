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

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Products</h1>
        <p>Manage your product catalog</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: '160px' }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📦</span>
          <h3>No Products Found</h3>
          <p>Add your first product to get started.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Cost Price</th>
                <th style={{ textAlign: 'right' }}>Retail Price</th>
                <th style={{ textAlign: 'right' }}>Wholesale Price</th>
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
                return (
                  <tr key={p._id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td><span className="badge badge-neutral">{p.category}</span></td>
                    <td style={{ textAlign: 'right' }}>{formatLKR(p.costPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--emerald-400)' }}>{formatLKR(retailPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber-400)' }}>{formatLKR(wholesalePrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {p.stock} {p.unit}
                    </td>
                    <td>
                      {p.stock === 0 ? (
                        <span className="badge badge-danger">Out of Stock</span>
                      ) : isLow ? (
                        <span className="badge badge-warning">Low Stock</span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-success btn-sm" onClick={() => openTopup(p)} title="Top Up Stock">+</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id!)}>🗑️</button>
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
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Top Up Stock</h2>
              <button className="modal-close" onClick={() => setTopupProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{topupProduct.name}</strong>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '14px' }}>
                <span>Current: <strong>{topupProduct.stock} {topupProduct.unit}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>+</span>
                <span style={{ color: 'var(--emerald-400)' }}>Top Up: <strong>{parseFloat(topupAmount) || 0} {topupProduct.unit}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>=</span>
                <span style={{ color: 'var(--amber-400)' }}>New: <strong>{topupProduct.stock + (parseFloat(topupAmount) || 0)} {topupProduct.unit}</strong></span>
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

      {/* Add/Edit Modal */}
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
                  background: 'var(--success-soft)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  color: 'var(--emerald-300)',
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
