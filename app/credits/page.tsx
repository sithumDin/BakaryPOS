'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ShoppingCart, Package, ClipboardList, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Credit, CreditPayment } from '@/lib/types';

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' });
}

type FilterType = 'all' | 'retail' | 'wholesale';

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showPaid, setShowPaid] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentModal, setPaymentModal] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [historyModal, setHistoryModal] = useState<Credit | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchCredits = () => {
    fetch('/api/credit')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCredits(Array.isArray(data) ? data : []))
      .catch(() => setCredits([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCredits(); }, []);

  const pendingCredits = credits.filter((c) => c.status !== 'paid');
  const paidCredits = credits.filter((c) => c.status === 'paid');

  const retailPending = pendingCredits.filter((c) => c.saleType === 'retail');
  const wholesalePending = pendingCredits.filter((c) => c.saleType === 'wholesale' || !c.saleType);

  const totalOutstanding = pendingCredits.reduce((s, c) => s + c.remainingAmount, 0);
  const retailOutstanding = retailPending.reduce((s, c) => s + c.remainingAmount, 0);
  const wholesaleOutstanding = wholesalePending.reduce((s, c) => s + c.remainingAmount, 0);

  const baseList = showPaid ? credits : pendingCredits;

  const filtered = baseList.filter((c) => {
    const matchType = filter === 'all' || c.saleType === filter || (!c.saleType && filter === 'wholesale');
    const matchSearch = !search || c.customerName.toLowerCase().includes(search.toLowerCase()) || c.invoiceNo.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleRecordPayment = async () => {
    if (!paymentModal || !paymentAmount || submitting) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || amount > paymentModal.remainingAmount) return;

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

  const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    partial: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    paid: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Credit Management</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>Track and manage outstanding credit balances</p>
        </div>
        <button
          onClick={() => setShowPaid(!showPaid)}
          style={{
            padding: '8px 16px', borderRadius: 10,
            border: showPaid ? '1.5px solid #2563EB' : '1.5px solid #ECEEF5',
            background: showPaid ? '#EFF6FF' : '#fff',
            color: showPaid ? '#2563EB' : '#6B7280',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          {showPaid ? 'Hide Paid' : `Show Paid (${paidCredits.length})`}
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Outstanding</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color="#DC2626" strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626', lineHeight: 1.2 }}>{formatLKR(totalOutstanding)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{pendingCredits.length} pending</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retail Credit</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} color="#2563EB" strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: retailOutstanding > 0 ? '#DC2626' : '#16A34A', lineHeight: 1.2 }}>{formatLKR(retailOutstanding)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{retailPending.length} pending</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wholesale Credit</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color="#7C3AED" strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: wholesaleOutstanding > 0 ? '#DC2626' : '#16A34A', lineHeight: 1.2 }}>{formatLKR(wholesaleOutstanding)}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{wholesalePending.length} pending</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Records</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={18} color="#16A34A" strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1D23', lineHeight: 1.2 }}>{credits.length}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{paidCredits.length} fully paid</div>
        </div>

      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search customer or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 34px',
              borderRadius: 12, border: '1.5px solid #ECEEF5',
              fontSize: 13, background: '#fff', color: '#1A1D23',
              outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={13} color="#9CA3AF" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'retail', 'wholesale'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px', borderRadius: 10,
                border: filter === f ? '1.5px solid #3B82F6' : '1.5px solid #ECEEF5',
                background: filter === f ? '#EFF6FF' : '#fff',
                color: filter === f ? '#2563EB' : '#6B7280',
                fontWeight: filter === f ? 700 : 500,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Credits Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #ECEEF5' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <CreditCard size={26} color="#16A34A" strokeWidth={1.8} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1D23', margin: '0 0 6px' }}>No Credits Found</h3>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
            {search ? `No results for "${search}"` : `All ${filter === 'all' ? '' : filter + ' '}credits are settled.`}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F9FC', borderBottom: '2px solid #ECEEF5' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoice</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paid</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Outstanding</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((credit, idx) => {
                const saleType = credit.saleType || 'wholesale';
                const st = STATUS_STYLE[credit.status] || STATUS_STYLE.pending;
                const isExpanded = expandedRow === (credit._id || String(idx));
                const hasPayments = credit.payments && credit.payments.length > 0;

                return (
                  <>
                    <tr
                      key={credit._id || idx}
                      style={{
                        borderBottom: isExpanded ? 'none' : (idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none'),
                        transition: 'background 0.1s',
                        cursor: hasPayments ? 'pointer' : 'default',
                      }}
                      onClick={() => hasPayments && setExpandedRow(isExpanded ? null : (credit._id || String(idx)))}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFF')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Customer */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1D23' }}>{credit.customerName}</div>
                        {credit.customerPhone && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{credit.customerPhone}</div>
                        )}
                      </td>

                      {/* Invoice */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '3px 8px', borderRadius: 6 }}>
                          {credit.invoiceNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#6B7280' }}>
                        {formatDate(credit.createdAt)}
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 8,
                          fontSize: 11, fontWeight: 700,
                          background: saleType === 'retail' ? '#EFF6FF' : '#F5F3FF',
                          color: saleType === 'retail' ? '#2563EB' : '#7C3AED',
                          border: `1px solid ${saleType === 'retail' ? '#BFDBFE' : '#DDD6FE'}`,
                          textTransform: 'capitalize',
                        }}>
                          {saleType}
                        </span>
                      </td>

                      {/* Total */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                        {formatLKR(credit.totalAmount)}
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                        {formatLKR(credit.paidAmount)}
                        {hasPayments && (
                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                            {credit.payments.length} payment{credit.payments.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Outstanding */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: credit.remainingAmount > 0 ? '#DC2626' : '#16A34A' }}>
                          {formatLKR(credit.remainingAmount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 8,
                          fontSize: 11, fontWeight: 700,
                          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                          textTransform: 'capitalize',
                        }}>
                          {credit.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          {credit.status !== 'paid' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPaymentModal(credit); setPaymentAmount(''); setPaymentNote(''); }}
                              style={{ padding: '5px 12px', borderRadius: 9, background: '#F0FDF4', border: '1.5px solid #BBF7D0', color: '#16A34A', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              + Payment
                            </button>
                          )}
                          {hasPayments && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : (credit._id || String(idx))); }}
                              style={{ padding: '5px 8px', borderRadius: 9, background: '#F8F9FC', border: '1.5px solid #ECEEF5', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Payment History Expanded Row */}
                    {isExpanded && hasPayments && (
                      <tr key={`history-${credit._id}`} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td colSpan={9} style={{ padding: '0 16px 14px 16px', background: '#FAFBFF' }}>
                          <div style={{ borderRadius: 12, border: '1px solid #ECEEF5', overflow: 'hidden', marginTop: 2 }}>
                            <div style={{ padding: '8px 14px', background: '#F3F4F6', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Payment History
                            </div>
                            {[...credit.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: CreditPayment, pi: number) => (
                              <div
                                key={pi}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '9px 14px',
                                  borderTop: pi > 0 ? '1px solid #F3F4F6' : 'none',
                                  background: '#fff',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CreditCard size={13} color="#16A34A" strokeWidth={2} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>{formatLKR(p.amount)}</div>
                                    {p.note && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.note}</div>}
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{formatDate(p.date)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div
          className="modal-overlay"
          onClick={() => !submitting && setPaymentModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, width: 440, maxWidth: '95vw', boxShadow: '0 8px 40px rgba(0,0,0,0.14)', overflow: 'hidden' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #ECEEF5' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1D23', margin: 0 }}>Record Payment</h2>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>Add a payment against this credit</p>
              </div>
              <button
                onClick={() => setPaymentModal(null)}
                style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} color="#6B7280" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Credit Summary */}
              <div style={{ background: '#F8F9FC', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1D23' }}>{paymentModal.customerName}</div>
                    {paymentModal.customerPhone && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{paymentModal.customerPhone}</div>}
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 4 }}>{paymentModal.invoiceNo}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Outstanding</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#DC2626' }}>{formatLKR(paymentModal.remainingAmount)}</div>
                  </div>
                </div>
                {paymentModal.paidAmount > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ECEEF5', display: 'flex', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{formatLKR(paymentModal.totalAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Already Paid</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>{formatLKR(paymentModal.paidAmount)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Payment Amount (LKR) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  max={paymentModal.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <button
                onClick={() => setPaymentAmount(String(paymentModal.remainingAmount))}
                style={{ padding: '5px 14px', borderRadius: 9, background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 16 }}
              >
                Pay Full Amount ({formatLKR(paymentModal.remainingAmount)})
              </button>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Note (optional)
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Cash payment, Bank transfer..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #ECEEF5' }}>
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRecordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitting}
              >
                {submitting ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
