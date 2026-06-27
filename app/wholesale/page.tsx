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

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getWholesalePrice(product: Product) {
  return product.wholesalePrice ?? product.sellingPrice ?? 0;
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

export default function WholesalePage() {
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

  const subtotal = cart.reduce((sum, c) => sum + getWholesalePrice(c.product) * c.qty, 0);
  const discountAmount = parseFloat(discount) || 0;
  const otherChargesAmount = parseFloat(otherCharges) || 0;
  const total = subtotal - discountAmount + otherChargesAmount;
  const totalCost = cart.reduce((sum, c) => sum + c.product.costPrice * c.qty, 0);
  const profit = total - totalCost - otherChargesAmount;
  const upfrontAmount = isCredit ? Math.min(parseFloat(creditUpfrontPayment) || 0, total) : 0;
  const creditDue = isCredit ? Math.max(0, total - upfrontAmount) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customerName.trim()) { alert('Please enter customer name for wholesale order'); return; }
    setProcessing(true);
    const saleData = {
      customerName: customerName || 'Walk-in Customer',
      items: cart.map((c) => ({
        product: c.product._id,
        productName: c.product.name,
        qty: c.qty,
        unitPrice: getWholesalePrice(c.product),
        costPrice: c.product.costPrice,
        total: getWholesalePrice(c.product) * c.qty,
      })),
      subtotal, discount: discountAmount, otherCharges: otherChargesAmount,
      otherChargesDescription: otherChargesDescription.trim() || 'Other Charges',
      total, profit,
      paymentMethod: isCredit ? 'credit' : paymentMethod,
      saleType: 'wholesale' as const,
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
              sale: sale._id, invoiceNo: sale.invoiceNo, saleType: 'wholesale',
              totalAmount: total, paidAmount: upfrontAmount, remainingAmount: creditDue,
              payments: upfrontAmount > 0 ? [{ amount: upfrontAmount, date: new Date().toISOString(), note: 'Upfront payment at sale' }] : [],
              status: creditDue <= 0 ? 'paid' : upfrontAmount > 0 ? 'partial' : 'pending',
            }),
          });
        }
        await generateReceipt(sale);
        alert('Wholesale order completed.');
        setCart([]); setDiscount(''); setOtherCharges(''); setOtherChargesDescription('');
        setCustomerName(''); setCustomerPhone(''); setCreditUpfrontPayment('');
        setPaymentMethod('cash'); setIsCredit(false); setShowAdvanced(false);
        const updatedProducts = await fetch('/api/products').then((r) => r.json());
        setProducts(updatedProducts);
      }
    } catch (error) { console.error('Checkout failed:', error); alert('Order failed. Please try again.'); }
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

      {/* ══ LEFT PANEL — Cart ══ */}
      <div style={{ width: 380, flexShrink: 0, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '2px 0 20px rgba(0,0,0,0.06)' }}>

        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F1F5' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Wholesale Order</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Customer name (required)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 500, height: 42, borderRadius: 10, border: `1.5px solid ${!customerName.trim() && cart.length > 0 ? '#FCA5A5' : '#E8ECF4'}`, background: '#FAFBFF', color: '#1A1D23', outline: 'none' }}
            />
            <select
              value={isCredit ? 'credit' : paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'credit') { setIsCredit(true); setPaymentMethod('cash'); }
                else { setIsCredit(false); setPaymentMethod(v as 'cash' | 'transfer'); }
              }}
              style={{ width: 110, padding: '10px 12px', fontSize: 13, fontWeight: 600, height: 42, borderRadius: 10, border: '1.5px solid #E8ECF4', background: '#FAFBFF', color: '#1A1D23', outline: 'none' }}
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

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
                  <div key={item.product._id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', background: isHighlighted ? '#F8F9FF' : '#fff', borderBottom: '1px solid #F4F5F9', borderLeft: `3px solid ${isHighlighted ? '#2563EB' : 'transparent'}`, transition: 'all 0.12s' }}>
                    <div style={{ width: 58, height: 58, borderRadius: 14, flexShrink: 0, background: cs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={28} color={cs.text} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{formatLKR(getWholesalePrice(item.product))}</div>
                      <button onClick={() => removeFromCart(item.product._id!)} style={{ marginTop: 7, width: 24, height: 24, borderRadius: '50%', background: '#EFF3FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pencil size={11} color="#2563EB" strokeWidth={2} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <button onClick={() => decrementOrRemove(item.product._id!)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E8ECF4', background: '#fff', color: '#4B5563', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product._id!, 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E8ECF4', background: '#fff', color: '#4B5563', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {cart.length > 0 && showAdvanced && (
          <div style={{ borderTop: '1px solid #F0F1F5', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFBFF' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Discount (LKR)</div>
              <input type="number" step="0.01" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10, border: '1.5px solid #E8ECF4', background: '#fff', outline: 'none' }} />
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
                <input type="number" step="0.01" placeholder="0.00" value={creditUpfrontPayment} onChange={(e) => setCreditUpfrontPayment(e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10, border: '1.5px solid #E8ECF4', background: '#fff', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => setCreditUpfrontPayment((total / 2).toFixed(2))} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ECEEF5', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Half</button>
                  <button onClick={() => setCreditUpfrontPayment(total.toFixed(2))} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ECEEF5', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Full</button>
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Other Charges (LKR)</div>
              <input type="number" step="0.01" placeholder="0.00" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10, border: '1.5px solid #E8ECF4', background: '#fff', outline: 'none' }} />
              {otherChargesAmount > 0 && <input type="text" placeholder="e.g., Delivery" value={otherChargesDescription} onChange={(e) => setOtherChargesDescription(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '9px 12px', fontSize: 13, borderRadius: 10, border: '1.5px solid #E8ECF4', background: '#fff', outline: 'none' }} />}
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ padding: '14px 20px 10px', borderTop: '1px solid #F0F1F5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#6B7280' }}>
              <span>Subtotal</span><span style={{ color: '#374151', fontWeight: 600 }}>{formatLKR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: '#10B981', fontWeight: 600 }}>Discount</span><span style={{ color: '#10B981', fontWeight: 600 }}>−{formatLKR(discountAmount)}</span>
              </div>
            )}
            {otherChargesAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#6B7280' }}>
                <span>{otherChargesDescription || 'Other Charges'}</span><span style={{ color: '#374151', fontWeight: 600 }}>+{formatLKR(otherChargesAmount)}</span>
              </div>
            )}
            {isCredit && upfrontAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '3px 0' }}>
                <span>Paid Now</span><span style={{ fontWeight: 600, color: '#22C55E' }}>{formatLKR(upfrontAmount)}</span>
              </div>
            )}
            {isCredit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', padding: '3px 0' }}>
                <span>Credit Due</span><span style={{ fontWeight: 600, color: creditDue > 0 ? '#F97316' : '#22C55E' }}>{formatLKR(creditDue)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1.5px solid #F0F1F5' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1D23', textTransform: 'uppercase', letterSpacing: '0.4px' }}>TOTAL</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#1A1D23' }}>{formatLKR(total)}</span>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '10px 20px 0' }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: discountAmount > 0 ? '1.5px solid #10B981' : '1.5px solid #E8ECF4', background: discountAmount > 0 ? '#F0FDF9' : '#FAFBFF', color: discountAmount > 0 ? '#059669' : '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <span>{discountAmount > 0 ? 'Promo Applied' : 'Apply Promo'}</span>
              {discountAmount > 0
                ? <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3} /></span>
                : <Tag size={13} color="#9CA3AF" strokeWidth={2} />}
            </button>
            <button
              onClick={() => { if (!isCredit) setPaymentMethod(paymentMethod === 'cash' ? 'transfer' : 'cash'); }}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700, border: '1.5px solid #E8ECF4', background: '#FAFBFF', color: '#374151', cursor: 'pointer' }}
            >
              {paymentLabel}
            </button>
          </div>
        )}

        <div style={{ padding: '14px 20px 20px' }}>
          <button
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            style={{ width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none', background: cart.length === 0 ? '#E8ECF4' : processing ? '#93C5FD' : '#2563EB', color: cart.length === 0 ? '#B0B7C9' : '#fff', fontSize: 16, fontWeight: 700, cursor: cart.length === 0 || processing ? 'not-allowed' : 'pointer', boxShadow: cart.length > 0 && !processing ? '0 6px 20px rgba(37,99,235,0.32)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {processing
              ? <><Loader2 size={18} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              : cart.length === 0 ? 'Add items to place order'
              : isCredit
                ? creditDue <= 0 ? 'Full Payment' : upfrontAmount > 0 ? `Pay ${formatLKR(upfrontAmount)} + Credit` : 'Credit Sale'
              : 'Place Wholesale Order'}
          </button>
        </div>
      </div>

      {/* ══ RIGHT PANEL — Products ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F6FA' }}>

        <div style={{ height: 64, padding: '0 28px', background: '#fff', borderBottom: '1px solid #ECEEF5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, color: '#6B7280' }}><Menu size={22} strokeWidth={2} /></button>
            <div style={{ width: 1, height: 18, background: '#ECEEF5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={16} color="#2563EB" strokeWidth={2} /></div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1D23' }}>{currentDate}</span>
            </div>
            <div style={{ width: 1, height: 18, background: '#ECEEF5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={16} color="#16A34A" strokeWidth={2} /></div>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>{currentTime}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 16px', borderRadius: 99, background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>Wholesale</span>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #ECEEF5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}><Power size={16} strokeWidth={2} /></button>
          </div>
        </div>

        <div style={{ background: '#fff', borderBottom: '1px solid #ECEEF5', padding: '16px 28px', display: 'flex', gap: 10, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
          {(() => {
            const isActive = selectedCategory === '';
            return (
              <button onClick={() => setSelectedCategory('')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', borderRadius: 18, border: `2px solid ${isActive ? '#2563EB' : '#ECEEF5'}`, background: isActive ? '#EFF6FF' : '#fff', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, minWidth: 100 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: isActive ? '#2563EB' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <button key={cat} onClick={() => setSelectedCategory(isActive ? '' : cat)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', borderRadius: 18, border: `2px solid ${isActive ? '#2563EB' : '#ECEEF5'}`, background: isActive ? '#EFF6FF' : '#fff', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, minWidth: 100 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: isActive ? '#2563EB' : cs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={26} color={isActive ? '#fff' : cs.text} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#2563EB' : '#374151', textAlign: 'center', lineHeight: 1.25, whiteSpace: 'nowrap' }}>{cat}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{categoryCounts[cat]} Items</div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '16px 28px', background: '#fff', borderBottom: '1px solid #ECEEF5', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search wholesale products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProductIndex(0); }}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.09)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E8ECF4'; e.target.style.boxShadow = 'none'; }}
              style={{ width: '100%', padding: '14px 52px 14px 22px', border: '1.5px solid #E8ECF4', borderRadius: 99, fontSize: 14, color: '#374151', background: '#FAFBFF', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            />
            {search
              ? <button onClick={() => { setSearch(''); setSelectedProductIndex(0); }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}><X size={16} color="#9CA3AF" strokeWidth={2} /></button>
              : <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><Search size={18} color="#B0B7C9" strokeWidth={2} /></span>
            }
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 28px', background: '#F5F6FA' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="spinner" /></div>
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
                    style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: `2px solid ${isSelected ? '#2563EB' : 'transparent'}`, cursor: p.stock <= 0 ? 'not-allowed' : 'pointer', opacity: p.stock <= 0 ? 0.55 : 1, transition: 'all 0.13s', boxShadow: isSelected ? '0 0 0 4px rgba(37,99,235,0.12), 0 8px 24px rgba(37,99,235,0.10)' : isBlinking ? '0 0 0 4px rgba(37,99,235,0.2)' : '0 2px 14px rgba(0,0,0,0.06)', transform: isBlinking ? 'scale(1.04)' : 'scale(1)' }}
                  >
                    <div style={{ height: 138, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cs.bg, position: 'relative', overflow: 'hidden' }}>
                      <Icon size={70} color={cs.text} strokeWidth={1.2} />
                      {p.photo && (
                        <img src={p.photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      )}
                      {p.stock <= 0 && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', letterSpacing: '0.5px' }}>OUT OF STOCK</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', lineHeight: 1.3, marginBottom: 9 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cs.bg, color: cs.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '52%' }}>{p.category}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {p.stock > 0 && p.stock <= p.lowStockThreshold && <AlertTriangle size={11} color="#F97316" strokeWidth={2.5} />}
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#1A1D23' }}>{formatLKR(getWholesalePrice(p))}</span>
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
