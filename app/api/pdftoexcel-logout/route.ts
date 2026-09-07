import { NextResponse } from 'next/server';
import { PDFEXCEL_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Cierra la sesión borrando la cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PDFEXCEL_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
