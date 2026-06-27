'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Lock, User, AlertCircle } from 'lucide-react';
import { SHOP_BRANDING } from '@/lib/branding';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F6FA 50%, #EFF6FF 100%)',
      zIndex: 9999,
      padding: 24,
    }}>
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(37,99,235,0.07)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(37,99,235,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 420, position: 'relative',
        background: '#fff', borderRadius: 24,
        border: '1px solid #ECEEF5',
        boxShadow: '0 8px 48px rgba(37,99,235,0.10)',
        overflow: 'hidden',
      }}>

        {/* Top accent bar */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #2563EB, #1D4ED8, #3B82F6)' }} />

        <div style={{ padding: '40px 40px 36px' }}>

          {/* Logo + Brand */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 20px rgba(37,99,235,0.30)',
            }}>
              <ChefHat size={32} color="#fff" strokeWidth={1.8} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1D23', margin: '0 0 4px' }}>
              {SHOP_BRANDING.name}
            </h1>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Sign in to your POS account</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#FEF2F2', color: '#DC2626',
              padding: '11px 14px', borderRadius: 12,
              marginBottom: 20, fontSize: 13, fontWeight: 500,
              border: '1px solid #FECACA',
            }}>
              <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                marginTop: 8, padding: '13px 24px',
                fontSize: 15, fontWeight: 700,
                borderRadius: 12,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.30)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 28, marginBottom: 0 }}>
            {SHOP_BRANDING.name} · POS System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
