import { NextResponse } from 'next/server';
import { AUTH_COOKIE, sha256hex } from '@/lib/auth';

// Nunca cachear esta ruta.
export const dynamic = 'force-dynamic';

// Valida la contraseña contra XMLSCAN_PASSWORD (variable de entorno del
// servidor). Si coincide, setea una cookie httpOnly de sesión (7 días).
export async function POST(req: Request) {
  let password = '';
  try {
    const body = await req.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    password = '';
  }

  const expected = process.env.XMLSCAN_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'config' },
      { status: 500 }
    );
  }

  // Comparación tolerante a espacios accidentales (autocompletado/pegado).
  if (password.trim() !== expected.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // El token se deriva del valor crudo del env (igual que en el middleware).
  const token = await sha256hex(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
  return res;
}
