'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, DollarSign, Plus, Trash2, ChevronRight, Download, Printer, X } from 'lucide-react';
import { Product } from '@/lib/types';
import { generateQuotation } from '@/lib/pdf';

interface QuotationItem {
  product: string;
  productName: string;
  qty: number;
  unitPrice: number;
  unit: string;
  total: number;
}

interface Quotation {
  _id?: string;
  quotationNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  other: number;
  advance: number;
  total: number;
  notes: string;
  validUntil: string;
  quotationType: 'retail' | 'wholesale';
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt?: string;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EMPTY_FORM: Quotation = {
  quotationNo: '', customerName: '', customerPhone: '', customerEmail: '',
  customerAddress: '', items: [], subtotal: 0, discount: 0, other: 0, advance: 0,
  total: 0, notes: '', validUntil: '', quotationType: 'retail', status: 'draft',
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: '#FFF7ED', color: '#C2410C', label: 'Draft' },
  sent:     { bg: '#EFF6FF', color: '#2563EB', label: 'Sent' },
  accepted: { bg: '#F0FDF4', color: '#16A34A', label: 'Accepted' },
  rejected: { bg: '#FEF2F2', color: '#DC2626', label: 'Rejected' },
};

const CATEGORY_COLORS = [
  '#FEF3C7', '#EDE9FE', '#DBEAFE', '#FCE7F3', '#DCFCE7', '#FFF7ED', '#F1F5F9',
];

export default function QuotationsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'rejected'>('all');
  const [formData, setFormData] = useState<Quotation>(EMPTY_FORM);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/products'), fetch('/api/quotations')])
      .then(async ([pr, qr]) => {
        if (pr.ok) setProducts(await pr.json().then(d => Array.isArray(d) ? d : []));
        if (qr.ok) setQuotations(await qr.json().then(d => Array.isArray(d) ? d : []));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const recalc = (items: QuotationItem[], discount: number, other: number, advance: number) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    return { subtotal, total: subtotal - discount + other - advance };
  };

  const addItemToQuotation = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p._id === selectedProduct);
    if (!product) return;
    const qty = parseInt(selectedQty) || 1;
    const price = formData.quotationType === 'retail'
      ? (product.retailPrice ?? product.sellingPrice ?? 0)
      : (product.wholesalePrice ?? product.sellingPrice ?? 0);
    const updatedItems = [...formData.items, { product: product._id || '', productName: product.name, qty, unitPrice: price, unit: product.unit, total: price * qty }];
    const { subtotal, total } = recalc(updatedItems, formData.discount, formData.other, formData.advance);
    setFormData({ ...formData, items: updatedItems, subtotal, total });
    setSelectedProduct(''); setSelectedQty('1');
  };

  const addManualItem = () => {
    if (!manualItemName.trim() || !manualItemPrice) return;
    const price = parseFloat(manualItemPrice);
    const updatedItems = [...formData.items, { product: 'manual-' + Date.now(), productName: manualItemName.trim(), qty: 1, unitPrice: price, unit: '', total: price }];
    const { subtotal, total } = recalc(updatedItems, formData.discount, formData.other, formData.advance);
    setFormData({ ...formData, items: updatedItems, subtotal, total });
    setManualItemName(''); setManualItemPrice('');
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const { subtotal, total } = recalc(updatedItems, formData.discount, formData.other, formData.advance);
    setFormData({ ...formData, items: updatedItems, subtotal, total });
  };

  const updateQtyInline = (index: number, qty: number) => {
    const updatedItems = formData.items.map((item, i) => i === index ? { ...item, qty, total: item.unitPrice * qty } : item);
    const { subtotal, total } = recalc(updatedItems, formData.discount, formData.other, formData.advance);
    setFormData({ ...formData, items: updatedItems, subtotal, total });
  };

  const updateDiscount = (v: number) => { const { subtotal, total } = recalc(formData.items, v, formData.other, formData.advance); setFormData({ ...formData, discount: v, subtotal, total }); };
  const updateOther    = (v: number) => { const { subtotal, total } = recalc(formData.items, formData.discount, v, formData.advance); setFormData({ ...formData, other: v, subtotal, total }); };
  const updateAdvance  = (v: number) => { const { subtotal, total } = recalc(formData.items, formData.discount, formData.other, v); setFormData({ ...formData, advance: v, subtotal, total }); };

  const handleSaveQuotation = async (asDraft = false) => {
    const pendingItems = [...formData.items];
    if (selectedProduct) {
      const product = products.find(p => p._id === selectedProduct);
      if (product) {
        const qty = parseInt(selectedQty) || 1;
        const price = formData.quotationType === 'retail' ? (product.retailPrice ?? product.sellingPrice ?? 0) : (product.wholesalePrice ?? product.sellingPrice ?? 0);
        pendingItems.push({ product: product._id || '', productName: product.name, qty, unitPrice: price, unit: product.unit, total: price * qty });
      }
    }
    if (manualItemName.trim() && manualItemPrice) {
      const price = parseFloat(manualItemPrice);
      if (!isNaN(price)) pendingItems.push({ product: 'manual-' + Date.now(), productName: manualItemName.trim(), qty: 1, unitPrice: price, unit: '', total: price });
    }
    if (!formData.customerName.trim() || pendingItems.length === 0) { alert('Please fill in customer name and add at least one item.'); return; }

    const { subtotal, total } = recalc(pendingItems, formData.discount, formData.other, formData.advance);
    const status = asDraft ? 'draft' : formData.status;
    const payload = { ...formData, items: pendingItems, subtotal, total, status };

    setSaving(true);
    try {
      const isUpdate = !!formData._id;
      const res = await fetch('/api/quotations', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUpdate ? { _id: formData._id, customerName: payload.customerName, customerPhone: payload.customerPhone, customerEmail: payload.customerEmail, customerAddress: payload.customerAddress, items: pendingItems, subtotal, discount: payload.discount, other: payload.other, advance: payload.advance, total, notes: payload.notes, validUntil: payload.validUntil, quotationType: payload.quotationType, status } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      try { await generateQuotation(data); } catch {}
      const qr = await fetch('/api/quotations');
      if (qr.ok) setQuotations(await qr.json().then(d => Array.isArray(d) ? d : []));
      setFormData(EMPTY_FORM); setSelectedProduct(''); setSelectedQty('1'); setManualItemName(''); setManualItemPrice('');
      setView('list');
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setSaving(false); }
  };

  const openCreate = () => { setFormData({ ...EMPTY_FORM, validUntil: new Date(Date.now() + 14 * 864e5).toISOString().split('T')[0] }); setView('create'); };
  const openEdit = (q: Quotation) => { setFormData(q); setView('create'); };

  const filteredQuotations = quotations.filter(q =>
    (q.customerName.toLowerCase().includes(search.toLowerCase()) || q.quotationNo.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'all' || q.status === statusFilter)
  );

  const totalCount    = quotations.length;
  const pendingCount  = quotations.filter(q => q.status === 'draft' || q.status === 'sent').length;
  const acceptedCount = quotations.filter(q => q.status === 'accepted').length;
  const totalValue    = quotations.reduce((s, q) => s + q.total, 0);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  /* ══════════════════════════════════════════════
     CREATE / EDIT VIEW — 2-panel full page
  ══════════════════════════════════════════════ */
  if (view === 'create') {
    const today = new Date().toISOString().split('T')[0];
    const balance = formData.total - formData.advance;

    return (
      <div style={{ margin: '-28px -32px', minHeight: '100vh', background: '#F5F6FA', display: 'flex', flexDirection: 'column' }}>

        {/* ── Top bar ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #ECEEF5', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9CA3AF' }}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontWeight: 600, fontSize: 13, padding: 0 }}>Quotations</button>
            <ChevronRight size={14} />
            <span style={{ color: '#1A1D23', fontWeight: 600 }}>{formData._id ? `Edit ${formData.quotationNo}` : 'Create Quotation'}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setView('list')} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => handleSaveQuotation(true)} disabled={saving} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => handleSaveQuotation(false)} disabled={saving} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              {saving ? 'Saving…' : formData._id ? '✓ Save Changes' : '✓ Send Quotation'}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', gap: 20, padding: 24, overflowY: 'auto', alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* Title */}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1D23', margin: 0 }}>{formData._id ? 'Edit Quotation' : 'Create Quotation'}</h1>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Add items, set prices and send quotation to your customer</p>
            </div>

            {/* Quotation Details card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 16 }}>Quotation Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Quotation ID</div>
                  <div style={{ padding: '9px 13px', background: '#F8F9FF', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{formData.quotationNo || 'Auto-generated'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Date</div>
                  <input type="date" value={today} readOnly style={{ width: '100%', padding: '9px 13px', background: '#F8F9FF', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Valid Until</div>
                  <input type="date" value={formData.validUntil} onChange={e => setFormData({ ...formData, validUntil: e.target.value })} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Customer Name *</div>
                  <input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="ABC Cafe & Restaurant" style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#1A1D23', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Type</div>
                  <select value={formData.quotationType} onChange={e => setFormData({ ...formData, quotationType: e.target.value as 'retail' | 'wholesale' })} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none', background: '#fff' }}>
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Add Item row */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 14 }}>Items</div>

              {/* Product selector */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ flex: 2, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none', background: '#fff' }}>
                  <option value="">Select product to add…</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} placeholder="Qty" style={{ width: 80, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none' }} />
                <button onClick={addItemToQuotation} disabled={!selectedProduct} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: selectedProduct ? '#2563EB' : '#E8ECF4', color: selectedProduct ? '#fff' : '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: selectedProduct ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} strokeWidth={2.5} /> Add Item
                </button>
              </div>

              {/* Manual item */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input type="text" value={manualItemName} onChange={e => setManualItemName(e.target.value)} placeholder="Custom item (e.g., Delivery, Transport…)" style={{ flex: 2, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none' }} />
                <input type="number" value={manualItemPrice} onChange={e => setManualItemPrice(e.target.value)} placeholder="Price" style={{ width: 110, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none' }} />
                <button onClick={addManualItem} disabled={!manualItemName.trim() || !manualItemPrice} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#F8F9FF', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Manual
                </button>
              </div>

              {/* Items table */}
              {formData.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 14, border: '2px dashed #ECEEF5', borderRadius: 12 }}>
                  No items added yet — select a product above
                </div>
              ) : (
                <div style={{ border: '1px solid #ECEEF5', borderRadius: 14, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8F9FF', borderBottom: '2px solid #ECEEF5' }}>
                        {['#', 'Item', 'Unit', 'Qty', 'Unit Price', 'Amount', ''].map((h, i) => (
                          <th key={i} style={{ padding: '10px 14px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', ...(i === 6 ? { width: 36 } : {}) }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F4F5F9' }}>
                          <td style={{ padding: '10px 14px', color: '#9CA3AF', fontWeight: 600, width: 36 }}>{i + 1}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 8, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 16 }}>🥐</span>
                              </div>
                              <span style={{ fontWeight: 600, color: '#1A1D23' }}>{item.productName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#9CA3AF' }}>{item.unit || 'pcs'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <input type="number" min="1" value={item.qty} onChange={e => updateQtyInline(i, parseInt(e.target.value) || 1)} style={{ width: 60, padding: '5px 8px', borderRadius: 8, border: '1.5px solid #ECEEF5', textAlign: 'center', fontSize: 13, outline: 'none' }} />
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{formatLKR(item.unitPrice)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1A1D23' }}>{formatLKR(item.total)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button onClick={() => removeItem(i)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={13} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Terms & Conditions */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 12 }}>Terms & Conditions</div>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Thank you for choosing our bakery products. This quotation is valid for the period mentioned above. Prices are subject to change without prior notice."
                style={{ width: '100%', minHeight: 100, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Customer Details card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23' }}>Customer Details</div>
              </div>
              {formData.customerName ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', marginBottom: 12 }}>{formData.customerName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Email</div>
                      <input type="email" value={formData.customerEmail} onChange={e => setFormData({ ...formData, customerEmail: e.target.value })} placeholder="customer@example.com" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Phone</div>
                      <input type="tel" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="+94 xx xxx xxxx" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Address</div>
                      <input type="text" value={formData.customerAddress} onChange={e => setFormData({ ...formData, customerAddress: e.target.value })} placeholder="Street, City" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #ECEEF5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF', fontSize: 13 }}>Enter customer name on the left</div>
              )}
            </div>

            {/* Summary card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 14 }}>Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280' }}>
                  <span>Sub Total</span><span style={{ fontWeight: 600, color: '#374151' }}>{formatLKR(formData.subtotal)}</span>
                </div>
                {/* Discount */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>Discount</span>
                  <input type="number" min="0" value={formData.discount} onChange={e => updateDiscount(parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #ECEEF5', fontSize: 12, textAlign: 'right', outline: 'none' }} />
                </div>
                {/* Other charges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>Other Charges</span>
                  <input type="number" min="0" value={formData.other} onChange={e => updateOther(parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #ECEEF5', fontSize: 12, textAlign: 'right', outline: 'none' }} />
                </div>
              </div>

              {/* Grand Total highlight */}
              <div style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Grand Total</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{formatLKR(formData.total)}</div>
              </div>

              {/* Advance / Balance */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>Advance Payment</span>
                  <input type="number" min="0" value={formData.advance} onChange={e => updateAdvance(parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #ECEEF5', fontSize: 12, textAlign: 'right', outline: 'none' }} />
                </div>
                {balance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>Balance Due</span>
                    <span style={{ fontWeight: 700, color: '#F97316' }}>{formatLKR(balance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status + Actions */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 12 }}>Quotation Status</div>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Quotation['status'] })} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: `1.5px solid ${STATUS_STYLES[formData.status]?.color}40`, background: STATUS_STYLES[formData.status]?.bg || '#F8F9FF', color: STATUS_STYLES[formData.status]?.color || '#374151', fontSize: 13, fontWeight: 700, outline: 'none', marginBottom: 14 }}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Delivery Date</div>
              <input type="date" value={formData.validUntil} onChange={e => setFormData({ ...formData, validUntil: e.target.value })} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #ECEEF5', fontSize: 13, color: '#374151', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Actions</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button title="Download PDF" style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#F8F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  <Download size={14} strokeWidth={2} /> PDF
                </button>
                <button title="Print" style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#F8F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151' }} onClick={() => window.print()}>
                  <Printer size={14} strokeWidth={2} /> Print
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     LIST VIEW
  ══════════════════════════════════════════════ */
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23', margin: 0 }}>Quotations</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Create and manage customer quotations</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Quotation</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Quotations', value: totalCount,                icon: <FileText size={18} color="#2563EB" />,  iconBg: '#EFF6FF' },
          { label: 'Pending',          value: pendingCount,              icon: <Clock size={18} color="#C2410C" />,     iconBg: '#FFF7ED' },
          { label: 'Accepted',         value: acceptedCount,             icon: <CheckCircle size={18} color="#16A34A" />, iconBg: '#F0FDF4' },
          { label: 'Total Value',      value: formatLKR(totalValue),     icon: <DollarSign size={18} color="#7C3AED" />, iconBg: '#F5F3FF' },
        ].map(({ label, value, icon, iconBg }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', border: '1px solid #ECEEF5', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#1A1D23' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input type="text" className="form-input" style={{ maxWidth: 360, borderRadius: 99 }} placeholder="Search by customer or quote number…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" style={{ width: 180, borderRadius: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredQuotations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
            <FileText size={40} color="#E0E3EE" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#BCC0CC', marginBottom: 4 }}>No quotations found</div>
            <div style={{ fontSize: 13 }}>Click "+ New Quotation" to create one</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Valid Until</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map(q => {
                const st = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
                return (
                  <tr key={q._id}>
                    <td><span style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 700, fontSize: 13 }}>{q.quotationNo}</span></td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#1A1D23' }}>{q.customerName}</div>
                      {q.customerPhone && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{q.customerPhone}</div>}
                    </td>
                    <td style={{ color: '#64748B', fontSize: 13 }}>{q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ color: '#64748B', fontSize: 13 }}>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ color: '#64748B', fontSize: 13 }}>{q.items.length} item{q.items.length !== 1 ? 's' : ''}</td>
                    <td style={{ fontWeight: 700, color: '#1A1D23' }}>{formatLKR(q.total)}</td>
                    <td>
                      <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => generateQuotation(q)} style={{ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #ECEEF5', background: '#F8F9FF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Download size={12} strokeWidth={2} /> PDF
                        </button>
                        <button onClick={() => openEdit(q)} style={{ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
