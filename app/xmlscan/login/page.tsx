'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function XmlscanLogin() {
  return (
    <Suspense fallback={<main className="auth-wrap" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const from = params.get('from') || '/xmlscan';

  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/xmlscan-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
        cache: 'no-store',
      });
      if (res.ok) {
        // Navegación dura: garantiza que el navegador envíe la cookie recién
        // creada y que el middleware se evalúe de cero. Evita la carrera del
        // router client-side (que a veces no veía la sesión y rebotaba al login).
        const target = from.startsWith('/xmlscan') ? from : '/xmlscan';
        window.location.assign(target);
        return; // dejamos loading=true mientras carga la página destino
      }
      if (res.status === 500) {
        setError('El proyecto aún no tiene contraseña configurada en el servidor.');
      } else {
        setError('Contraseña incorrecta.');
      }
      setPassword('');
      setLoading(false);
    } catch {
      setError('No se pudo verificar. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="auth-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" />
          </svg>
        </span>

        <h1 className="auth-title">XMLScan</h1>
        <p className="auth-sub">Este proyecto es privado. Ingresa la contraseña para continuar.</p>

        <label className="auth-label" htmlFor="pwd">
          Contraseña
        </label>
        <div className="auth-input-row">
          <input
            id="pwd"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
            className="auth-input"
          />
          <button
            type="button"
            className="auth-toggle"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9.5 9.5 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={loading || !password}>
          {loading ? 'Verificando…' : 'Entrar'}
        </button>

        <Link href="/" className="auth-back">
          ← Volver a NexaProyects
        </Link>
      </form>
    </main>
  );
}
