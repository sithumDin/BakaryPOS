'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Wheat, Cake, Croissant, Cookie, Sandwich, Coffee, Package, UtensilsCrossed,
  LayoutGrid, Search, ShoppingBag, ArrowRight, Calendar, Clock, Tag, Settings2, X, Loader2, AlertTriangle,
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
              if (lowerError.includes('not configured')) alert(`Sale completed. WhatsApp failed: ${errorText}. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID, then restart the server.`);
              else if (lowerError.includes('session has expired') || lowerError.includes('error validating access token') || lowerError.includes('invalid oauth access token')) alert(`Sale completed. WhatsApp failed: ${errorText}. Please regenerate WHATSAPP_ACCESS_TOKEN in Meta and restart the server.`);
              else if (lowerError.includes('invalid phone') || lowerError.includes('invalid wa id') || lowerError.includes('phone number')) alert(`Sale completed. WhatsApp failed: ${errorText}. Please ensure the phone number is correct with country code (+94).`);
              else alert(`Sale completed. WhatsApp failed: ${errorText}. Please check WhatsApp API credentials and try again.`);
            }
          } catch (error) { console.error('WhatsApp send error:', error); alert('Sale completed. WhatsApp could not be sent due to a network error.'); }
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

  return (
    <div style={{ display: 'flex', margin: '-28px -32px', height: '100vh', overflow: 'hidden', background: '#F4F6FB' }}>

      {/* ── LEFT: Order / Cart Panel ── */}
      <div style={{ width: 360, flexShrink: 0, background: '#fff', borderRight: '1px solid #EAECF0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cart Panel Header */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Current Order</span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} style={{ fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type="text"
              placeholder={isCredit ? 'Customer name (required)' : 'Walk-in Customer'}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', fontSize: 13, height: 36, borderRadius: 8 }}
            />
            <select
              className="form-select"
              value={isCredit ? 'credit' : paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'credit') { setIsCredit(true); setPaymentMethod('cash'); }
                else { setIsCredit(false); setPaymentMethod(v as 'cash' | 'transfer'); }
              }}
              style={{ padding: '8px 28px 8px 10px', fontSize: 13, height: 36, borderRadius: 8 }}
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={48} color="#D1D5DB" strokeWidth={1.25} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>No items yet</div>
              <div style={{ fontSize: 12, color: '#D1D5DB' }}>Click products to add them here</div>
            </div>
          ) : (
            cart.map((item, index) => {
              const cs = getCategoryStyle(item.product.category);
              const Icon = cs.icon;
              const isHighlighted = selectedCartIndex === index;
              return (
                <div
                  key={item.product._id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
                    background: isHighlighted ? '#F0FDF4' : 'transparent',
                    borderLeft: isHighlighted ? '3px solid #22C55E' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Circular icon thumbnail */}
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: cs.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    <Icon size={22} color={cs.text} strokeWidth={1.75} />
                  </div>
                  {/* Name + unit price */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      {formatLKR(getRetailPrice(item.product))}
                    </div>
                  </div>
                  {/* Qty controls */}
                  <div style={{ display: 'flex', alignItems: 'center', background: '#F3F4F6', borderRadius: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => decrementOrRemove(item.product._id!)}
                      style={{ width: 28, height: 28, borderRadius: '8px 0 0 8px', border: 'none', background: 'transparent', color: '#6B7280', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'center', color: '#111827' }}>{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.product._id!, 1)}
                      style={{ width: 28, height: 28, borderRadius: '0 8px 8px 0', border: 'none', background: 'transparent', color: '#6B7280', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  </div>
                  {/* Line total */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
                    {formatLKR(getRetailPrice(item.product) * item.qty)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick action buttons */}
        {cart.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10, border: 'none',
                background: showAdvanced ? '#DCFCE7' : '#F3F4F6',
                color: showAdvanced ? '#16A34A' : '#374151',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Tag size={14} strokeWidth={2} /> Apply Discount
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10, border: 'none',
                background: '#F3F4F6', color: '#374151',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Settings2 size={14} strokeWidth={2} /> Options
            </button>
          </div>
        )}

        {/* Expanded options */}
        {cart.length > 0 && showAdvanced && (
          <div style={{ borderTop: '1px solid #F3F4F6', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, background: '#FAFAFA' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Discount (LKR)</div>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setIsCredit(!isCredit)}>
              <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: isCredit ? '#22C55E' : '#D1D5DB', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: isCredit ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Credit Sale</span>
            </div>
            {isCredit && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 5 }}>Upfront Payment (LKR)</div>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" min={0} max={total} value={creditUpfrontPayment} onChange={(e) => setCreditUpfrontPayment(e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment((total / 2).toFixed(2))}>Half</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment(total.toFixed(2))}>Full</button>
                  {creditUpfrontPayment && <button className="btn btn-secondary btn-sm" onClick={() => setCreditUpfrontPayment('')}>Clear</button>}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 5 }}>Other Charges (LKR)</div>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }} />
              {otherChargesAmount > 0 && (
                <input className="form-input" type="text" placeholder="e.g., Delivery Cost" value={otherChargesDescription} onChange={(e) => setOtherChargesDescription(e.target.value)} style={{ marginTop: 6, padding: '8px 10px', fontSize: 13 }} />
              )}
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Send WhatsApp Receipt</span>
              </label>
              {sendWhatsApp && (
                <input className="form-input" type="text" placeholder="+94 76 180 9833" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ marginTop: 6, padding: '8px 10px', fontSize: 13 }} />
              )}
            </div>
          </div>
        )}

        {/* Order Summary */}
        {cart.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', padding: '3px 0' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{formatLKR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', padding: '3px 0' }}>
                <span>Discount</span>
                <span style={{ fontWeight: 600, color: '#EF4444' }}>−{formatLKR(discountAmount)}</span>
              </div>
            )}
            {otherChargesAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', padding: '3px 0' }}>
                <span>{otherChargesDescription || 'Other Charges'}</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>+{formatLKR(otherChargesAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0 4px', borderTop: '1.5px solid #F3F4F6', marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>TOTAL</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{formatLKR(total)}</span>
            </div>
            {isCredit && upfrontAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '2px 0' }}>
                <span>Paid Now</span>
                <span style={{ fontWeight: 600, color: '#22C55E' }}>{formatLKR(upfrontAmount)}</span>
              </div>
            )}
            {isCredit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '2px 0' }}>
                <span>Credit Due</span>
                <span style={{ fontWeight: 600, color: creditDue > 0 ? '#F97316' : '#22C55E' }}>{formatLKR(creditDue)}</span>
              </div>
            )}
            {!isCredit && profit > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', padding: '2px 0' }}>
                <span>Est. profit</span>
                <span style={{ color: '#22C55E' }}>{formatLKR(profit)}</span>
              </div>
            )}
          </div>
        )}

        {/* Place Order button */}
        <div style={{ padding: '12px 16px 16px', borderTop: cart.length > 0 ? '1px solid #F3F4F6' : 'none', flexShrink: 0 }}>
          <button
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            style={{
              width: '100%', padding: '15px 20px', borderRadius: 14, border: 'none',
              background: cart.length === 0 ? '#E5E7EB' : processing ? '#86EFAC' : 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: cart.length === 0 ? '#9CA3AF' : '#fff',
              fontSize: 15, fontWeight: 700,
              cursor: cart.length === 0 || processing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: cart.length > 0 && !processing ? '0 4px 18px rgba(34,197,94,0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>
              {processing ? 'Processing...'
                : cart.length === 0 ? 'Add items to place order'
                : isCredit
                  ? creditDue <= 0 ? `Full Payment — ${formatLKR(total)}`
                    : upfrontAmount > 0 ? `Pay ${formatLKR(upfrontAmount)} + Credit`
                    : `Credit Sale — ${formatLKR(total)}`
                : 'Place Order'}
            </span>
            {processing
              ? <Loader2 size={18} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
              : cart.length > 0
              ? <ArrowRight size={18} strokeWidth={2.5} />
              : null}
          </button>
        </div>
      </div>

      {/* ── RIGHT: Menu Panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F4F6FB' }}>

        {/* Header */}
        <div style={{ height: 58, padding: '0 24px', background: '#fff', borderBottom: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Calendar size={14} color="#9CA3AF" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{currentDate}</span>
            </div>
            <div style={{ width: 1, height: 14, background: '#E5E7EB' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={14} color="#9CA3AF" strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{currentTime}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>Open Order</span>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #EAECF0', padding: '14px 24px 0', display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
          {/* All Menu */}
          <button
            onClick={() => setSelectedCategory('')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 18px 12px', border: 'none', background: 'transparent',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
              borderBottom: `3px solid ${selectedCategory === '' ? '#22C55E' : 'transparent'}`,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: selectedCategory === '' ? '#DCFCE7' : '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 2,
            }}>
              <LayoutGrid size={24} color={selectedCategory === '' ? '#16A34A' : '#6B7280'} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: selectedCategory === '' ? '#16A34A' : '#374151', whiteSpace: 'nowrap' }}>All Menu</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{products.length} Items</div>
          </button>

          {CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) > 0).map((cat) => {
            const cs = getCategoryStyle(cat);
            const Icon = cs.icon;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isActive ? '' : cat)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 18px 12px', border: 'none', background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                  borderBottom: `3px solid ${isActive ? '#22C55E' : 'transparent'}`,
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: isActive ? '#DCFCE7' : cs.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 2,
                }}>
                  <Icon size={24} color={isActive ? '#16A34A' : cs.text} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#16A34A' : '#374151', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{cat}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{categoryCounts[cat]} Items</div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="#9CA3AF" strokeWidth={2} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search something sweet on your mind..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProductIndex(0); }}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => { e.target.style.borderColor = '#22C55E'; e.target.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.10)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              style={{ width: '100%', padding: '12px 44px 12px 44px', border: '1.5px solid #E5E7EB', borderRadius: 99, fontSize: 14, color: '#111827', background: '#F9FAFB', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSelectedProductIndex(0); }}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <X size={16} color="#9CA3AF" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6FB' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
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
                      background: '#fff', borderRadius: 18, overflow: 'hidden',
                      border: `2px solid ${isSelected ? '#22C55E' : 'transparent'}`,
                      cursor: p.stock <= 0 ? 'not-allowed' : 'pointer',
                      opacity: p.stock <= 0 ? 0.5 : 1,
                      transition: 'all 0.14s',
                      boxShadow: isSelected
                        ? '0 0 0 4px rgba(34,197,94,0.18), 0 8px 24px rgba(34,197,94,0.14)'
                        : isBlinking
                        ? '0 0 0 4px rgba(34,197,94,0.3)'
                        : '0 2px 12px rgba(0,0,0,0.07)',
                      transform: isBlinking ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    {/* Icon image area */}
                    <div style={{
                      height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: cs.bg, position: 'relative',
                    }}>
                      <Icon size={64} color={cs.text} strokeWidth={1.25} />
                      {p.stock <= 0 && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.72)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: '0.5px' }}>OUT OF STOCK</span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3, marginBottom: 5 }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                          {formatLKR(getRetailPrice(p))}
                        </span>
                        {p.stock > 0 && p.stock <= p.lowStockThreshold && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#F97316', fontWeight: 600 }}>
                            <AlertTriangle size={10} strokeWidth={2} /> {p.stock} left
                          </span>
                        )}
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
