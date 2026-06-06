'use client';

import { useEffect, useState } from 'react';
import { Credit } from '@/lib/types';

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FilterType = 'all' | 'retail' | 'wholesale';

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [paymentModal, setPaymentModal] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCredits = () => {
    fetch('/api/credit')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCredits(Array.isArray(data) ? data : []))
      .catch(() => setCredits([])
      ).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCredits(); }, []);

  const pendingCredits = credits.filter((c) => c.status !== 'paid');

  const filtered = pendingCredits.filter((c) => {
    if (filter === 'all') return true;
    return c.saleType === filter;
  });

  const retailCredits = pendingCredits.filter((c) => c.saleType === 'retail');
  const wholesaleCredits = pendingCredits.filter((c) => c.saleType === 'wholesale' || !c.saleType);

  const totalOutstanding = pendingCredits.reduce((s, c) => s + c.remainingAmount, 0);
  const retailOutstanding = retailCredits.reduce((s, c) => s + c.remainingAmount, 0);
  const wholesaleOutstanding = wholesaleCredits.reduce((s, c) => s + c.remainingAmount, 0);

  const handleRecordPayment = async () => {
    if (!paymentModal || !paymentAmount || submitting) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > paymentModal.remainingAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditId: paymentModal._id,
          payment: { amount, date: new Date().toISOString(), note: paymentNote },
        }),
      });
      if (res.ok) {
        setPaymentModal(null);
        setPaymentAmount('');
        setPaymentNote('');
        fetchCredits();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>💳 Credit Tracker</h1>
        <p>Track outstanding credit sales for retail and wholesale</p>
      </div>

      {/* Summary Stats */}
      <div className="stat-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Outstanding</span>
            <div className="stat-card-icon yellow">💰</div>
          </div>
          <div className="stat-card-value" style={{ color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--emerald-400)' }}>
            {formatLKR(totalOutstanding)}
          </div>
          <div className="stat-card-change">{pendingCredits.length} pending</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Retail Credit</span>
            <div className="stat-card-icon red">🛒</div>
          </div>
          <div className="stat-card-value" style={{ color: retailOutstanding > 0 ? 'var(--danger)' : 'var(--emerald-400)' }}>
            {formatLKR(retailOutstanding)}
          </div>
          <div className="stat-card-change">{retailCredits.length} pending</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Wholesale Credit</span>
            <div className="stat-card-icon blue">📦</div>
          </div>
          <div className="stat-card-value" style={{ color: wholesaleOutstanding > 0 ? 'var(--warning)' : 'var(--emerald-400)' }}>
            {formatLKR(wholesaleOutstanding)}
          </div>
          <div className="stat-card-change">{wholesaleCredits.length} pending</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {(['all', 'retail', 'wholesale'] as FilterType[]).map((f) => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `All (${pendingCredits.length})` : f === 'retail' ? `Retail (${retailCredits.length})` : `Wholesale (${wholesaleCredits.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="icon">✅</span>
          <h3>No Outstanding Credits</h3>
          <p>All {filter === 'all' ? '' : filter + ' '}credits have been paid.</p>
        </div>
      ) : (
        <div className="credit-cards">
          {filtered.map((credit) => {
            const saleType = (credit as Credit & { saleType?: string }).saleType || 'wholesale';
            return (
              <div key={credit._id} className="credit-card">
                <div className="credit-card-header">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                      {credit.customerName}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {credit.invoiceNo}
                      </span>
                      <span className={`badge ${saleType === 'retail' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                        {saleType}
                      </span>
                    </div>
                  </div>
                  <span className={`badge ${credit.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                    {credit.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{formatLKR(credit.totalAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--emerald-400)' }}>{formatLKR(credit.paidAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Remaining</div>
                    <div className="credit-amount">{formatLKR(credit.remainingAmount)}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(credit.paidAmount / credit.totalAmount) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--emerald-600), var(--emerald-400))',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Payment History */}
                {credit.payments && credit.payments.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Payment History:</div>
                    {credit.payments.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString('en-LK')}</span>
                        {p.note && <span style={{ color: 'var(--text-dim)', flex: 1, margin: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note}</span>}
                        <span style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>{formatLKR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setPaymentModal(credit); setPaymentAmount(''); setPaymentNote(''); }}
                  style={{ width: '100%' }}
                >
                  💵 Record Payment
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => !submitting && setPaymentModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="modal-close" onClick={() => setPaymentModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>
                <strong>{paymentModal.customerName}</strong> — {paymentModal.invoiceNo}
              </p>
              <p style={{ marginBottom: '16px' }}>
                Outstanding: <strong style={{ color: 'var(--warning)' }}>{formatLKR(paymentModal.remainingAmount)}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Payment Amount (LKR)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  max={paymentModal.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPaymentAmount(String(paymentModal.remainingAmount))}
                style={{ marginBottom: '12px' }}
              >
                Pay Full Amount
              </button>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Payment note..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={!paymentAmount || submitting}>
                {submitting ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
