'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  name: string;
  username: string;
  role: 'admin' | 'cashier';
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'cashier' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.user || data.user.role !== 'admin') {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      });
  }, [router]);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (currentUser) fetchUsers();
  }, [currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      setShowModal(false);
      setForm({ name: '', username: '', password: '', role: 'cashier' });
      fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${user._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete user');
      return;
    }
    fetchUsers();
  };

  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalCashiers = users.filter((u) => u.role === 'cashier').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>Manage system users and permissions</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setError(''); setShowModal(true); }}
        >
          + Add User
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {/* Total Users */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#EFF6FF', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              👥
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Total Users</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1D23', margin: '2px 0 0' }}>{totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Admins */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FFF7ED', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              👑
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Admins</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1D23', margin: '2px 0 0' }}>{totalAdmins}</p>
            </div>
          </div>
        </div>

        {/* Cashiers */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#F0FDF4', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🏪
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Cashiers</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1D23', margin: '2px 0 0' }}>{totalCashiers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#1A1D23' }}>{u.name}</td>
                    <td style={{ color: '#9CA3AF' }}>{u.username}</td>
                    <td>
                      <span className={u.role === 'admin' ? 'badge badge-warning' : 'badge badge-info'}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ color: '#9CA3AF', fontSize: 13 }}>
                      {new Date(u.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {currentUser && u._id !== currentUser.id && (
                        <button
                          style={{
                            padding: '5px 9px',
                            borderRadius: 9,
                            border: '1.5px solid #FED7AA',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDelete(u)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700, color: '#1A1D23' }}>Add New User</h3>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Kamal Perera"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., kamal123"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Set a strong password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={4}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {error && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#DC2626',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
