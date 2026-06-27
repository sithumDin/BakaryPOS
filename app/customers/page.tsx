'use client';

import { useEffect, useState } from 'react';
import { Customer } from '@/lib/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    type: 'retail' as 'retail' | 'wholesale',
  });

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed");
        return r.json();
      })
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error(e);
        setCustomers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', type: 'retail' });
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, type: c.type });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    const data = {
      ...(editing ? { _id: editing._id } : {}),
      ...form,
    };

    const res = await fetch('/api/customers', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowModal(false);
      fetchCustomers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchCustomers();
  };

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchType = !filterType || c.type === filterType;
    return matchSearch && matchType;
  });

  const retailCount = customers.filter((c) => c.type === 'retail').length;
  const wholesaleCount = customers.filter((c) => c.type === 'wholesale').length;

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Customers</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>Manage retail and wholesale customer records</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Total Customers */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Customers</span>
            <span style={{ fontSize: 20, background: '#EFF6FF', borderRadius: 10, padding: '4px 8px' }}>👥</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1D23' }}>{customers.length}</div>
        </div>

        {/* Retail */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retail</span>
            <span style={{ fontSize: 20, background: '#F0FDF4', borderRadius: 10, padding: '4px 8px' }}>🛒</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1D23' }}>{retailCount}</div>
        </div>

        {/* Wholesale */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wholesale</span>
            <span style={{ fontSize: 20, background: '#F5F3FF', borderRadius: 10, padding: '4px 8px' }}>🏭</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1D23' }}>{wholesaleCount}</div>
        </div>
      </div>

      {/* Search + Filter Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #ECEEF5', borderRadius: 99, padding: '0 14px', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#9CA3AF' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#1A1D23', padding: '10px 0' }}
          />
        </div>
        <select
          className="form-select"
          style={{ width: 150, borderRadius: 12 }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
      </div>

      {/* Customers Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 14 }}>
                  No customers found
                </td>
              </tr>
            ) : (
              filtered.map((c, idx) => (
                <tr key={c._id}>
                  <td style={{ color: '#9CA3AF', fontSize: 13 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: '#1A1D23' }}>{c.name}</td>
                  <td style={{ fontFamily: 'monospace', color: '#4B5563' }}>{c.phone || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4B5563' }}>{c.address || '—'}</td>
                  <td>
                    {c.type === 'retail' ? (
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB' }}>
                        Retail
                      </span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED' }}>
                        Wholesale
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(c)}
                        style={{ background: '#F8FAFC', border: '1px solid #ECEEF5', borderRadius: 9, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#4B5563' }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(c._id!)}
                        style={{ background: '#FFF5F5', border: '1px solid #FEE2E2', borderRadius: 9, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#DC2626' }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="07X XXXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  <select
                    className="form-select"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'retail' | 'wholesale' })}
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.name}>
                {editing ? 'Update' : 'Add'} Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
