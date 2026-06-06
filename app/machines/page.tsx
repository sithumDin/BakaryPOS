'use client';

import { useEffect, useState } from 'react';

interface Machine {
  _id: string;
  name: string;
  type: string;
  milkCostPerPacket: number;
  dailyRentalFee: number;
  notes: string;
  isActive: boolean;
}

interface UsageRecord {
  _id: string;
  machineName: string;
  milkPacketsUsed: number;
  milkCostPerPacket: number;
  dailyRentalFee: number;
  totalCost: number;
  notes: string;
  date: string;
}

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = { name: '', type: '', milkCostPerPacket: '', dailyRentalFee: '', notes: '' };

export default function MachinesPage() {
  const [tab, setTab]             = useState<'usage' | 'machines'>('usage');
  const [machines, setMachines]   = useState<Machine[]>([]);
  const [usage, setUsage]         = useState<UsageRecord[]>([]);
  const [range, setRange]         = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(emptyForm);

  // usage log form
  const [selMachine, setSelMachine]   = useState('');
  const [packets, setPackets]         = useState('');
  const [usageNotes, setUsageNotes]   = useState('');
  const [loggingUsage, setLoggingUsage] = useState(false);

  const fetchAll = async (r = range) => {
    setLoading(true);
    try {
      const [mRes, uRes] = await Promise.all([
        fetch('/api/machines'),
        fetch(`/api/machines/usage?range=${r}`),
      ]);
      setMachines(mRes.ok ? await mRes.json() : []);
      setUsage(uRes.ok ? await uRes.json() : []);
    } catch {
      setMachines([]); setUsage([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(range); }, [range]);

  /* ── Machine CRUD ── */
  const resetForm = () => { setForm(emptyForm); setEditingId(''); setShowForm(false); };

  const handleSaveMachine = async () => {
    if (!form.name.trim() || !form.milkCostPerPacket) {
      alert('Name and milk cost per packet are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        _id: editingId || undefined,
        name: form.name.trim(),
        type: form.type.trim(),
        milkCostPerPacket: parseFloat(form.milkCostPerPacket) || 0,
        dailyRentalFee: parseFloat(form.dailyRentalFee) || 0,
        notes: form.notes.trim(),
      };
      await fetch('/api/machines', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      resetForm();
      fetchAll(range);
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = (m: Machine) => {
    setForm({
      name: m.name,
      type: m.type,
      milkCostPerPacket: String(m.milkCostPerPacket),
      dailyRentalFee: String(m.dailyRentalFee),
      notes: m.notes,
    });
    setEditingId(m._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this machine?')) return;
    await fetch(`/api/machines?id=${id}`, { method: 'DELETE' });
    fetchAll(range);
  };

  /* ── Usage logging ── */
  const selectedMachine = machines.find((m) => m._id === selMachine);

  const handleLogUsage = async () => {
    const pkt = parseInt(packets, 10);
    if (!selMachine || !pkt || pkt <= 0) { alert('Select a machine and enter packets used'); return; }
    setLoggingUsage(true);
    try {
      const res = await fetch('/api/machines/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: selMachine,
          machineName: selectedMachine?.name,
          milkPacketsUsed: pkt,
          milkCostPerPacket: selectedMachine?.milkCostPerPacket || 0,
          dailyRentalFee: selectedMachine?.dailyRentalFee || 0,
          notes: usageNotes,
        }),
      });
      if (!res.ok) { alert('Failed to log usage'); return; }
      setSelMachine(''); setPackets(''); setUsageNotes('');
      fetchAll(range);
    } catch { alert('Failed to log usage'); }
    finally { setLoggingUsage(false); }
  };

  const handleDeleteUsage = async (id: string) => {
    if (!confirm('Remove this entry?')) return;
    await fetch(`/api/machines/usage?id=${id}`, { method: 'DELETE' });
    fetchAll(range);
  };

  /* ── Aggregates ── */
  const totalCost      = usage.reduce((s, u) => s + u.totalCost, 0);
  const totalPackets   = usage.reduce((s, u) => s + u.milkPacketsUsed, 0);
  const totalRental    = usage.reduce((s, u) => s + u.dailyRentalFee, 0);
  const totalMilkCost  = usage.reduce((s, u) => s + u.milkPacketsUsed * u.milkCostPerPacket, 0);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>☕ Machine Tracker</h1>
        <p>Track rental machines and milk usage costs</p>
      </div>

      {/* Summary */}
      <div className="stat-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Cost ({range})</span>
            <div className="stat-card-icon red">💸</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--danger)', fontSize: '22px' }}>{formatLKR(totalCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Milk Cost ({range})</span>
            <div className="stat-card-icon yellow">🥛</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--warning)', fontSize: '22px' }}>{formatLKR(totalMilkCost)}</div>
          <div className="stat-card-change">{totalPackets} packets used</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Rental Fee ({range})</span>
            <div className="stat-card-icon blue">🔧</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--info)', fontSize: '22px' }}>{formatLKR(totalRental)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Active Machines</span>
            <div className="stat-card-icon green">⚙️</div>
          </div>
          <div className="stat-card-value">{machines.filter((m) => m.isActive).length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>Usage Log</button>
        <button className={`tab ${tab === 'machines' ? 'active' : ''}`} onClick={() => setTab('machines')}>Machines ({machines.length})</button>
      </div>

      {tab === 'usage' ? (
        <div>
          {/* Log Usage form */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Log Usage</h3>
            {machines.filter((m) => m.isActive).length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No active machines. Add one in the Machines tab first.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
                <div>
                  <label className="form-label">Machine</label>
                  <select className="form-select" value={selMachine} onChange={(e) => setSelMachine(e.target.value)}>
                    <option value="">Select machine...</option>
                    {machines.filter((m) => m.isActive).map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}{m.type ? ` (${m.type})` : ''} — {formatLKR(m.milkCostPerPacket)}/pkt
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Milk Packets Used</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={packets}
                    onChange={(e) => setPackets(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogUsage(); }}
                  />
                </div>
                <div>
                  <label className="form-label">Note (optional)</label>
                  <input className="form-input" type="text" placeholder="e.g. Morning shift" value={usageNotes} onChange={(e) => setUsageNotes(e.target.value)} />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleLogUsage}
                  disabled={loggingUsage || !selMachine || !packets}
                >
                  {loggingUsage ? 'Saving...' : 'Log'}
                </button>
              </div>
            )}

            {/* Cost preview */}
            {selectedMachine && packets && parseInt(packets) > 0 && (
              <div style={{ marginTop: '14px', padding: '12px 16px', background: 'var(--green-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--green-200)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Milk cost: <strong style={{ color: 'var(--green-700)' }}>{formatLKR(parseInt(packets) * selectedMachine.milkCostPerPacket)}</strong>
                </span>
                {selectedMachine.dailyRentalFee > 0 && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Rental fee: <strong style={{ color: 'var(--info)' }}>{formatLKR(selectedMachine.dailyRentalFee)}</strong>
                  </span>
                )}
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Total: <strong style={{ color: 'var(--danger)' }}>{formatLKR(parseInt(packets) * selectedMachine.milkCostPerPacket + (selectedMachine.dailyRentalFee || 0))}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Range filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Show:</span>
            {(['today', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${range === r ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRange(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Usage log table */}
          {usage.length === 0 ? (
            <div className="empty-state">
              <span className="icon">☕</span>
              <h3>No usage recorded</h3>
              <p>Log milk usage above to track machine costs.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th style={{ textAlign: 'right' }}>Packets</th>
                    <th style={{ textAlign: 'right' }}>Milk Cost</th>
                    <th style={{ textAlign: 'right' }}>Rental</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Note</th>
                    <th>Date / Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 600 }}>{u.machineName}</td>
                      <td style={{ textAlign: 'right' }}>🥛 {u.milkPacketsUsed}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatLKR(u.milkPacketsUsed * u.milkCostPerPacket)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--info)' }}>{formatLKR(u.dailyRentalFee)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatLKR(u.totalCost)}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.notes || '—'}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(u.date).toLocaleString('en-LK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUsage(u._id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-primary)' }}>
                    <td style={{ fontWeight: 700, padding: '12px 18px' }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '12px 18px' }}>🥛 {totalPackets}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--warning)', padding: '12px 18px' }}>{formatLKR(totalMilkCost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--info)', padding: '12px 18px' }}>{formatLKR(totalRental)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', padding: '12px 18px' }}>{formatLKR(totalCost)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Machines tab */
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>+ Add Machine</button>
          </div>

          {/* Machine form */}
          {showForm && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
                {editingId ? 'Edit Machine' : 'Add Machine'}
              </h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Machine Name *</label>
                  <input className="form-input" placeholder="e.g. Cappuccino Machine" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type / Brand</label>
                  <input className="form-input" placeholder="e.g. Espresso, Latte" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Milk Cost per Packet (LKR) *</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.milkCostPerPacket} onChange={(e) => setForm({ ...form, milkCostPerPacket: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Rental Fee (LKR)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.dailyRentalFee} onChange={(e) => setForm({ ...form, dailyRentalFee: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="e.g. Rented from XYZ" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveMachine} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add Machine'}
                </button>
              </div>
            </div>
          )}

          {machines.length === 0 ? (
            <div className="empty-state">
              <span className="icon">⚙️</span>
              <h3>No machines added yet</h3>
              <p>Add your rental machines to start tracking costs.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Milk Cost/Packet</th>
                    <th style={{ textAlign: 'right' }}>Daily Rental</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr key={m._id}>
                      <td style={{ fontWeight: 700 }}>☕ {m.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.type || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--warning)' }}>🥛 {formatLKR(m.milkCostPerPacket)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--info)' }}>{m.dailyRentalFee > 0 ? formatLKR(m.dailyRentalFee) : '—'}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.notes || '—'}</td>
                      <td>
                        <span className={`badge ${m.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {m.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(m)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m._id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
