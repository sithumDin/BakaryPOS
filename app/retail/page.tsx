'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Wheat, Cake, Croissant, Cookie, Sandwich, Coffee, Package, UtensilsCrossed,
  LayoutGrid, Search, ShoppingBag, Calendar, Clock, X, Loader2, AlertTriangle,
  Menu, Pencil, Power, Check, Tag,
  type LucideIcon,
} from 'lucide-react';
import { Product, CartItem, CATEGORIES } from '@/lib/types';
import { generateReceipt } from '@/lib/pdf';
import { SHOP_BRANDING } from '@/lib/branding';

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRetailPrice(product: Product) {
  return product.retailPrice ?? product.sellingPrice ?? 0;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
  'Bread':              { bg: '#FEF3C7', text: '#92400E', icon: Wheat },
  'Cakes':              { bg: '#FCE7F3', text: '#9D174D', icon: Cake },
  'Pastries':           { bg: '#EDE9FE', text: '#5B21B6', icon: Croissant },
  'Cookies & Biscuits': { bg: '#FFF7ED', text: '#78350F', icon: Cookie },
  'Rolls & Buns':       { bg: '#FEF9C3', text: '#713F12', icon: Sandwich },
  'Savories':           { bg: '#DCFCE7', text: '#14532D', icon: UtensilsCrossed },
  'Beverages':          { bg: '#DBEAFE', text: '#1E3A8A', icon: Coffee },
  'Other':              { bg: '#F1F5F9', text: '#475569', icon: Package },
};

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES['Other'];
}

export default function RetailPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [blinkProductId, setBlinkProductId] = useState<string | null>(null);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [isCredit, setIsCredit] = useState(false);
  const [discount, setDiscount] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [otherChargesDescription, setOtherChargesDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [creditUpfrontPayment, setCreditUpfrontPayment] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => { if (!r.ok) throw new Error('Fetch failed'); return r.json(); })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((e) => { console.error(e); setProducts([]); })
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    if (product._id) {
      setBlinkProductId(product._id);
      setTimeout(() => setBlinkProductId((prev) => (prev === product._id ? null : prev)), 250);
    }
    const existing = cart.find((c) => c.product._id === product._id);
    if (existing) {
      if (existing.qty >= product.stock) return;
      setCart(cart.map((c) => c.product._id === product._id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { product, qty: 1, discount: 0 }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.product._id === productId) {
        const newQty = c.qty + delta;
        if (newQty <= 0 || newQty > 10000) return c;
        return { ...c, qty: newQty };
      }
      return c;
    }));
  };

  const decrementOrRemove = (productId: string) => {
    const item = cart.find((c) => c.product._id === productId);
    if (!item) return;
    if (item.qty <= 1) removeFromCart(productId);
    else updateQty(productId, -1);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product._id !== productId));
  };

  const subtotal = cart.reduce((sum, c) => sum + getRetailPrice(c.product) * c.qty, 0);
  const discountAmount = parseFloat(discount) || 0;
  const otherChargesAmount = parseFloat(otherCharges) || 0;
  const total = subtotal - discountAmount + otherChargesAmount;
  const totalCost = cart.reduce((sum, c) => sum + c.product.costPrice * c.qty, 0);
  const profit = total - totalCost - otherChargesAmount;
  const upfrontAmount = isCredit ? Math.min(parseFloat(creditUpfrontPayment) || 0, total) : 0;
  const creditDue = isCredit ? Math.max(0, total - upfrontAmount) : 0;
  const whatsappPhonePattern = /^\+94\s\d{2}\s\d{3}\s\d{4}$/;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCredit && !customerName.trim()) { alert('Please enter customer name for credit sale'); return; }
    if (sendWhatsApp) {
      if (!customerPhone.trim()) { alert('Please enter customer WhatsApp number. Format: +94 76 180 9833'); return; }
      if (!whatsappPhonePattern.test(customerPhone.trim())) { alert('Invalid number format. Please use: +94 76 180 9833'); return; }
    }
    setProcessing(true);
    const saleData = {
      customerName: customerName || 'Walk-in Customer',
      items: cart.map((c) => ({
        product: c.product._id,
        productName: c.product.name,
        qty: c.qty,
        unitPrice: getRetailPrice(c.product),
        costPrice: c.product.costPrice,
        total: getRetailPrice(c.product) * c.qty,
      })),
      subtotal, discount: discountAmount, otherCharges: otherChargesAmount,
      otherChargesDescription: otherChargesDescription.trim() || 'Other Charges',
      total, profit,
      paymentMethod: isCredit ? 'credit' : paymentMethod,
      saleType: 'retail' as const,
      date: new Date().toISOString(),
    };
    try {
      const res = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        const sale = await res.json();
        if (isCredit) {
          await fetch('/api/credit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerName: customerName.trim(), customerPhone: customerPhone.trim(),
              sale: sale._id, invoiceNo: sale.invoiceNo, saleType: 'retail',
              totalAmount: total, paidAmount: upfrontAmount, remainingAmount: creditDue,
              payments: upfrontAmount > 0 ? [{ amount: upfrontAmount, date: new Date().toISOString(), note: 'Upfront payment at sale' }] : [],
              status: creditDue <= 0 ? 'paid' : upfrontAmount > 0 ? 'partial' : 'pending',
            }),
          });
        }
        await generateReceipt(sale);
        if (sendWhatsApp) {
          const text = [`${SHOP_BRANDING.name} Receipt`, `Invoice: ${sale.invoiceNo}`, `Customer: ${sale.customerName || 'Walk-in Customer'}`, `Total: ${formatLKR(sale.total)}`, `Payment: ${sale.paymentMethod}`, `Date: ${new Date(sale.date).toLocaleString('en-LK')}`, `Thank you for your purchase!`].join('\n');
          try {
            const waRes = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: customerPhone.trim(), text }) });
            if (waRes.ok) { alert('Sale completed. WhatsApp message sent successfully.'); }
            else {
              const waData = await waRes.json().catch(() => ({ error: 'Failed to send WhatsApp' }));
              const errorText = String(waData.error || 'Unknown error');
              const lowerError = errorText.toLowerCase();
              if (lowerError.includes('not configured')) alert(`Sale completed. WhatsApp failed: ${errorText}.`);
              else if (lowerError.includes('session has expired') || lowerError.includes('invalid oauth')) alert(`Sale completed. WhatsApp token expired: ${errorText}.`);
              else alert(`Sale completed. WhatsApp failed: ${errorText}.`);
            }
          } catch (error) { console.error('WhatsApp send error:', error); alert('Sale completed. WhatsApp could not be sent.'); }
        } else { alert('Sale completed.'); }
        setCart([]); setDiscount(''); setOtherCharges(''); setOtherChargesDescription('');
        setCustomerName(''); setCustomerPhone(''); setCreditUpfrontPayment('');
        setSendWhatsApp(false); setPaymentMethod('cash'); setIsCredit(false); setShowAdvanced(false);
        const updatedProducts = await fetch('/api/products').then((r) => r.json());
        setProducts(updatedProducts);
      }
    } catch (error) { console.error('Checkout failed:', error); alert('Sale failed. Please try again.'); }
    finally { setProcessing(false); }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (!selectedCategory || p.category === selectedCategory)
  );

  const selectableProducts = filteredProducts.filter((p) => p.stock > 0);
  const selectedProductId = selectedProductIndex >= 0 && selectedProductIndex < selectableProducts.length
    ? selectableProducts[selectedProductIndex]?._id : undefined;
  const selectedCartItem = cart[selectedCartIndex];

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = products.filter((p) => p.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    setSelectedCartIndex((prev) => cart.length === 0 ? 0 : Math.min(prev, cart.length - 1));
  }, [cart.length]);

  useEffect(() => {
    const onGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isFormField = !!target && (target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
      if (!isFormField && e.key === '/') { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (isFormField) return;
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); if (!processing && cart.length > 0) handleCheckout(); return; }
      if (cart.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedCartIndex((prev) => (prev + 1) % cart.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedCartIndex((prev) => (prev - 1 + cart.length) % cart.length); return; }
      if (!selectedCartItem) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); updateQty(selectedCartItem.product._id!, 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (selectedCartItem.qty > 1) updateQty(selectedCartItem.product._id!, -1); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeFromCart(selectedCartItem.product._id!); }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [cart, processing, selectedCartItem]);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (selectableProducts.length === 0) return;
      e.preventDefault();
      setSelectedProductIndex((prev) => {
        if (prev < 0) return 0;
        return e.key === 'ArrowDown' ? (prev + 1) % selectableProducts.length : (prev - 1 + selectableProducts.length) % selectableProducts.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = selectedProductIndex >= 0 ? selectableProducts[selectedProductIndex] : selectableProducts[0];
      if (p) { addToCart(p); setSearch(''); setSelectedProductIndex(0); }
    }
  };

  const paymentLabel = isCredit ? 'Credit' : paymentMethod === 'cash' ? 'Cash' : 'Transfer';

  return (
    <div style={{ display: 'flex', margin: '-28px -32px', height: '100vh', overflow: 'hidden', background: '#F5F6FA', fontFamily: 'inherit' }}>

      {/* ══════════════ LEFT PANEL — Cart ══════════════ */}
      <div style={{ width: 380, flexShrink: 0, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '2px 0 20px rgba(0,0,0,0.06)' }}>

        {/* ── Cart Header: two select-style inputs ── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F1F5' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              type="text"
              placeholder={isCredit ? 'Customer name (required)' : 'Walk-in Customer'}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 500,
                height: 42, borderRadius: 10, border: '1.5px solid #E8ECF4',
                background: '#FAFBFF', color: '#1A1D23', outline: 'none',
              }}
            />
            <select
              className="form-select"
              value={isCredit ? 'credit' : paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'credit') { setIsCredit(true); setPaymentMethod('cash'); }
                else { setIsCredit(false); setPaymentMethod(v as 'cash' | 'transfer'); }
              }}
              style={{
                width: 110, padding: '10px 12px', fontSize: 13, fontWeight: 600,
                height: 42, borderRadius: 10, border: '1.5px solid #E8ECF4',
                background: '#FAFBFF', color: '#1A1D23', outline: 'none',
              }}
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

        {/* ── Cart Items ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
              <ShoppingBag size={52} color="#E0E3EE" strokeWidth={1.2} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#BCC0CC' }}>No items yet</div>
              <div style={{ fontSize: 13, color: '#D4D7E3' }}>Click a product to add it</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 6px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                <button onClick={() => setCart([])} style={{ fontSize: 11, fontWeight: 600, color: '#C0C4D0', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
              </div>
              {cart.map((item, index) => {
                const cs = getCategoryStyle(item.product.category);
                const Icon = cs.icon;
                const isHighlighted = selectedCartIndex === index;
                return (
                  <div
                    key={item.product._id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 20px',
                      background: isHighlighted ? '#F8F9FF' : '#fff',
                      borderBottom: '1px solid #F4F5F9',
                      borderLeft: `3px solid ${isHighlighted ? '#2563EB' : 'transparent'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{
                      width: 58, height: 58, borderRadius: 14, flexShrink: 0,
                      background: cs.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={28} color={cs.text} strokeWidth={1.5} />
                    </div>

                    {/* Name + price + pencil */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                        {formatLKR(getRetailPrice(item.product))}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product._id!)}
                        style={{
                          marginTop: 7, width: 24, height: 24, borderRadius: '50%',
                          background: '#EFF3FF', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Pencil size={11} color="#2563EB" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Qty controls — inline plain style like reference */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <button
                        onClick={() => decrementOrRemove(item.product._id!)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E8ECF4', background: '#fff', color: '#4B5563', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                      >−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.product._id!, 1)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E8ECF4', background: '#fff', color: '#4B5563', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── Advanced options (collapsible) ── */}
        {cart.length > 0 && showAdvanced && (
          <div style={{ borderTop: '1px solid #F0F1F5', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFBFF' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Discount (LKR)</div>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ padding: '9px 12px', fontSize: 13, borderRadius: 10 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setIsCredit(!isCredit)}>
              <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: isCredit ? '#2563EB' : '#D1D5DB', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: isCredit ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Credit Sale</span>
            </div>
            {isCredit && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Upfront Payment (LKR)</div>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" min={0} max={total} value={creditUpfrontPayment} onChange={(e) => setCreditUpfrontPayment(e.target.value)} style={{ padding: '9px 12px', fontSize: 13, borderRadius: 10 }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment((total / 2).toFixed(2))}>Half</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment(total.toFixed(2))}>Full</button>
                  {creditUpfrontPayment && <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment('')}>Clear</button>}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Other Charges (LKR)</div>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} style={{ padding: '9px 12px', fontSize: 13, borderRadius: 10 }} />
              {otherChargesAmount > 0 && (
                <input className="form-input" type="text" placeholder="e.g., Delivery Cost" value={otherChargesDescription} onChange={(e) => setOtherChargesDescription(e.target.value)} style={{ marginTop: 6, padding: '9px 12px', fontSize: 13, borderRadius: 10 }} />
              )}
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Send WhatsApp Receipt</span>
              </label>
              {sendWhatsApp && (
                <input className="form-input" type="text" placeholder="+94 76 180 9833" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ marginTop: 6, padding: '9px 12px', fontSize: 13, borderRadius: 10 }} />
              )}
            </div>
          </div>
        )}

        {/* ── Order Summary ── */}
        {cart.length > 0 && (
          <div style={{ padding: '14px 20px 10px', borderTop: '1px solid #F0F1F5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13, color: '#6B7280' }}>
              <span>Subtotal</span>
              <span style={{ color: '#374151', fontWeight: 600 }}>{formatLKR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: '#10B981', fontWeight: 600 }}>Discount</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>−{formatLKR(discountAmount)}</span>
              </div>
            )}
            {otherChargesAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13, color: '#6B7280' }}>
                <span>{otherChargesDescription || 'Other Charges'}</span>
                <span style={{ color: '#374151', fontWeight: 600 }}>+{formatLKR(otherChargesAmount)}</span>
              </div>
            )}
            {isCredit && upfrontAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '3px 0' }}>
                <span>Paid Now</span>
                <span style={{ fontWeight: 600, color: '#22C55E' }}>{formatLKR(upfrontAmount)}</span>
              </div>
            )}
            {isCredit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '3px 0' }}>
                <span>Credit Due</span>
                <span style={{ fontWeight: 600, color: creditDue > 0 ? '#F97316' : '#22C55E' }}>{formatLKR(creditDue)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1.5px solid #F0F1F5' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', textTransform: 'uppercase', letterSpacing: '0.4px' }}>TOTAL</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#1A1D23' }}>{formatLKR(total)}</span>
            </div>
            {!isCredit && profit > 0 && (
              <div style={{ textAlign: 'right', fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                Est. profit <span style={{ color: '#22C55E', fontWeight: 600 }}>{formatLKR(profit)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Bottom action row: Promo + Payment type ── */}
        {cart.length > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '10px 20px 0' }}>
            {/* Promo/Discount pill — like "Promo Applied" in reference */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                border: discountAmount > 0 ? '1.5px solid #10B981' : '1.5px solid #E8ECF4',
                background: discountAmount > 0 ? '#F0FDF9' : '#FAFBFF',
                color: discountAmount > 0 ? '#059669' : '#6B7280',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <span>{discountAmount > 0 ? 'Promo Applied' : 'Apply Promo'}</span>
              {discountAmount > 0 && (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={11} color="#fff" strokeWidth={3} />
                </span>
              )}
              {!discountAmount && <Tag size={13} color="#9CA3AF" strokeWidth={2} />}
            </button>

            {/* Payment type pill — like "QRIS" in reference */}
            <button
              onClick={() => {
                if (!isCredit) setPaymentMethod(paymentMethod === 'cash' ? 'transfer' : 'cash');
              }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700,
                border: '1.5px solid #E8ECF4', background: '#FAFBFF',
                color: '#374151', cursor: 'pointer',
              }}
            >
              {paymentLabel}
            </button>
          </div>
        )}

        {/* ── Place Order button ── */}
        <div style={{ padding: '14px 20px 20px' }}>
          <button
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none',
              background: cart.length === 0 ? '#E8ECF4' : processing ? '#93C5FD' : '#2563EB',
              color: cart.length === 0 ? '#B0B7C9' : '#fff',
              fontSize: 16, fontWeight: 700, letterSpacing: '0.2px',
              cursor: cart.length === 0 || processing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: cart.length > 0 && !processing ? '0 6px 20px rgba(37,99,235,0.32)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {processing
              ? <><Loader2 size={18} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              : cart.length === 0 ? 'Add items to place order'
              : isCredit
                ? creditDue <= 0 ? 'Full Payment' : upfrontAmount > 0 ? `Pay ${formatLKR(upfrontAmount)} + Credit` : 'Credit Sale'
              : 'Place Order'}
          </button>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL — Menu ══════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F6FA' }}>

        {/* ── Top header bar ── */}
        <div style={{
          height: 64, padding: '0 28px', background: '#fff',
          borderBottom: '1px solid #ECEEF5',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, color: '#6B7280' }}>
              <Menu size={22} strokeWidth={2} />
            </button>
            <div style={{ width: 1, height: 18, background: '#ECEEF5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color="#2563EB" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1D23' }}>{currentDate}</span>
            </div>
            <div style={{ width: 1, height: 18, background: '#ECEEF5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color="#16A34A" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>{currentTime}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 16px', borderRadius: 99, background: '#F0FDF4', border: '1.5px solid #BBF7D0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>Open Order</span>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
              <Power size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Category card tiles ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #ECEEF5', padding: '16px 28px', display: 'flex', gap: 10, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>

          {/* All Menu */}
          {(() => {
            const isActive = selectedCategory === '';
            return (
              <button
                onClick={() => setSelectedCategory('')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 20px', borderRadius: 18, border: `2px solid ${isActive ? '#2563EB' : '#ECEEF5'}`,
                  background: isActive ? '#EFF6FF' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, minWidth: 100,
                }}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: isActive ? '#2563EB' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LayoutGrid size={26} color={isActive ? '#fff' : '#9CA3AF'} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#2563EB' : '#374151', whiteSpace: 'nowrap' }}>All Menu</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{products.length} Items</div>
              </button>
            );
          })()}

          {CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) > 0).map((cat) => {
            const cs = getCategoryStyle(cat);
            const Icon = cs.icon;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isActive ? '' : cat)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 20px', borderRadius: 18, border: `2px solid ${isActive ? '#2563EB' : '#ECEEF5'}`,
                  background: isActive ? '#EFF6FF' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, minWidth: 100,
                }}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: isActive ? '#2563EB' : cs.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={26} color={isActive ? '#fff' : cs.text} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#2563EB' : '#374151', textAlign: 'center', lineHeight: 1.25, whiteSpace: 'nowrap' }}>{cat}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{categoryCounts[cat]} Items</div>
              </button>
            );
          })}
        </div>

        {/* ── Search bar (icon on right like reference) ── */}
        <div style={{ padding: '16px 28px', background: '#fff', borderBottom: '1px solid #ECEEF5', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search something sweet on your mind...."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProductIndex(0); }}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.09)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E8ECF4'; e.target.style.boxShadow = 'none'; }}
              style={{
                width: '100%', padding: '14px 52px 14px 22px',
                border: '1.5px solid #E8ECF4', borderRadius: 99,
                fontSize: 14, color: '#374151', background: '#FAFBFF',
                outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
            {search ? (
              <button
                onClick={() => { setSearch(''); setSelectedProductIndex(0); }}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <X size={16} color="#9CA3AF" strokeWidth={2} />
              </button>
            ) : (
              <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <Search size={18} color="#B0B7C9" strokeWidth={2} />
              </span>
            )}
          </div>
        </div>

        {/* ── Product grid ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 28px', background: '#F5F6FA' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div className="spinner" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <Wheat size={48} color="#CBD5E1" strokeWidth={1.25} style={{ margin: '0 auto 12px' }} />
              <h3>No Products Found</h3>
              <p>Try a different search or category</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {filteredProducts.map((p) => {
                const cs = getCategoryStyle(p.category);
                const Icon = cs.icon;
                const isSelected = selectedProductId === p._id;
                const isBlinking = blinkProductId === p._id;
                return (
                  <div
                    key={p._id}
                    onClick={() => addToCart(p)}
                    style={{
                      background: '#fff',
                      borderRadius: 20,
                      overflow: 'hidden',
                      border: `2px solid ${isSelected ? '#2563EB' : 'transparent'}`,
                      cursor: p.stock <= 0 ? 'not-allowed' : 'pointer',
                      opacity: p.stock <= 0 ? 0.55 : 1,
                      transition: 'all 0.13s',
                      boxShadow: isSelected
                        ? '0 0 0 4px rgba(37,99,235,0.12), 0 8px 24px rgba(37,99,235,0.10)'
                        : isBlinking
                        ? '0 0 0 4px rgba(37,99,235,0.2)'
                        : '0 2px 14px rgba(0,0,0,0.06)',
                      transform: isBlinking ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    {/* Product image / icon area */}
                    <div style={{
                      height: 138, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: cs.bg, position: 'relative', overflow: 'hidden',
                    }}>
                      <Icon size={70} color={cs.text} strokeWidth={1.2} />
                      {p.photo && (
                        <img src={p.photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      )}
                      {p.stock <= 0 && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', letterSpacing: '0.5px' }}>OUT OF STOCK</span>
                        </div>
                      )}
                    </div>

                    {/* Card info */}
                    <div style={{ padding: '12px 14px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', lineHeight: 1.3, marginBottom: 9 }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        {/* Category badge */}
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 10px', borderRadius: 99,
                          background: cs.bg, color: cs.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '52%',
                        }}>
                          {p.category}
                        </span>
                        {/* Price */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {p.stock > 0 && p.stock <= p.lowStockThreshold && (
                            <AlertTriangle size={11} color="#F97316" strokeWidth={2.5} />
                          )}
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#1A1D23' }}>
                            {formatLKR(getRetailPrice(p))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
