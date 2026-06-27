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
  const [selMachine, setSelMachine]     = useState('');
  const [packets, setPackets]           = useState('');
  const [usageNotes, setUsageNotes]     = useState('');
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
  const totalCost     = usage.reduce((s, u) => s + u.totalCost, 0);
  const totalPackets  = usage.reduce((s, u) => s + u.milkPacketsUsed, 0);
  const totalRental   = usage.reduce((s, u) => s + u.dailyRentalFee, 0);
  const totalMilkCost = usage.reduce((s, u) => s + u.milkPacketsUsed * u.milkCostPerPacket, 0);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Machine Tracker</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0 0' }}>Track rental machines and milk usage costs</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setTab('machines'); resetForm(); setShowForm(true); }}
        >
          + Add Machine
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cost ({range})</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#EF4444,#DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💸</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{formatLKR(totalCost)}</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Milk Cost ({range})</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F59E0B,#D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🥛</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{formatLKR(totalMilkCost)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{totalPackets} packets used</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rental Fee ({range})</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔧</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>{formatLKR(totalRental)}</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Machines</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚙️</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1D23' }}>{machines.filter((m) => m.isActive).length}</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['usage', 'machines'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700,
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#2563EB' : '#6B7280',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t === 'usage' ? 'Usage Log' : `Machines (${machines.length})`}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          USAGE TAB
      ══════════════════════════════════════ */}
      {tab === 'usage' && (
        <div>
          {/* Log Usage Card */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1D23', margin: '0 0 16px 0' }}>Log Usage</h3>

            {machines.filter((m) => m.isActive).length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>No active machines. Add one in the Machines tab first.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
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
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Morning shift"
                    value={usageNotes}
                    onChange={(e) => setUsageNotes(e.target.value)}
                  />
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
              <div style={{ marginTop: 14, padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Milk cost: <strong style={{ color: '#059669' }}>{formatLKR(parseInt(packets) * selectedMachine.milkCostPerPacket)}</strong>
                </span>
                {selectedMachine.dailyRentalFee > 0 && (
                  <span style={{ fontSize: 13, color: '#6B7280' }}>
                    Rental fee: <strong style={{ color: '#2563EB' }}>{formatLKR(selectedMachine.dailyRentalFee)}</strong>
                  </span>
                )}
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Total: <strong style={{ color: '#DC2626' }}>{formatLKR(parseInt(packets) * selectedMachine.milkCostPerPacket + (selectedMachine.dailyRentalFee || 0))}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Range filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Show:</span>
            {(['today', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: range === r ? '#2563EB' : '#F3F4F6',
                  color: range === r ? '#fff' : '#6B7280',
                  transition: 'all 0.15s',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Usage table */}
          {usage.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1D23', margin: '0 0 8px 0' }}>No usage recorded</h3>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Log milk usage above to track machine costs.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                      <td style={{ textAlign: 'right', color: '#D97706' }}>{formatLKR(u.milkPacketsUsed * u.milkCostPerPacket)}</td>
                      <td style={{ textAlign: 'right', color: '#2563EB' }}>{formatLKR(u.dailyRentalFee)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{formatLKR(u.totalCost)}</td>
                      <td style={{ color: '#9CA3AF', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.notes || '—'}</td>
                      <td style={{ color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(u.date).toLocaleString('en-LK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteUsage(u._id)}
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #FED7AA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F9FAFB', borderTop: '2px solid #ECEEF5' }}>
                    <td style={{ fontWeight: 700, padding: '12px 18px', color: '#1A1D23' }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '12px 18px' }}>🥛 {totalPackets}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#D97706', padding: '12px 18px' }}>{formatLKR(totalMilkCost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563EB', padding: '12px 18px' }}>{formatLKR(totalRental)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#DC2626', padding: '12px 18px' }}>{formatLKR(totalCost)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          MACHINES TAB
      ══════════════════════════════════════ */}
      {tab === 'machines' && (
        <div>
          {machines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1D23', margin: '0 0 8px 0' }}>No machines added</h3>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 20px 0' }}>Add your rental machines to start tracking costs.</p>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>+ Add Machine</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {machines.map((m) => (
                <div
                  key={m._id}
                  style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      ⚙️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1D23', marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF' }}>{m.type || 'No type set'}</div>
                    </div>
                    <span className={`badge ${m.isActive ? 'badge-success' : 'badge-neutral'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Cost details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{ background: '#FFF7ED', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Milk/Pkt</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#D97706' }}>{formatLKR(m.milkCostPerPacket)}</div>
                    </div>
                    <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Daily Rental</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{m.dailyRentalFee > 0 ? formatLKR(m.dailyRentalFee) : '—'}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  {m.notes && (
                    <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: m.notes ? 0 : 4 }}>
                    <button
                      onClick={() => handleEdit(m)}
                      style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m._id)}
                      style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #FED7AA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          ADD / EDIT MACHINE MODAL
      ══════════════════════════════════════ */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
        >
          <div className="modal">
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1D23', margin: 0 }}>
                {editingId ? 'Edit Machine' : 'Add Machine'}
              </h2>
              <button
                onClick={resetForm}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1, padding: '0 4px' }}
              >
                ×
              </button>
            </div>

            {/* Form fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Machine Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Cappuccino Machine"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type / Brand</label>
                <input
                  className="form-input"
                  placeholder="e.g. Espresso, Latte"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Milk Cost per Packet (LKR) *</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.milkCostPerPacket}
                  onChange={(e) => setForm({ ...form, milkCostPerPacket: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Daily Rental Fee (LKR)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.dailyRentalFee}
                  onChange={(e) => setForm({ ...form, dailyRentalFee: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Notes</label>
              <input
                className="form-input"
                placeholder="e.g. Rented from XYZ"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #ECEEF5' }}>
              <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveMachine} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Machine' : 'Add Machine'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
