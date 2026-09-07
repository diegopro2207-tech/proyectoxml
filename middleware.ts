import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

// Protege /xmlscan y sus subrutas. Si no hay cookie de sesión válida, redirige
// a la pantalla de login, que queda excluida para no entrar en un bucle.
//
// /pdftoexcel es público a propósito: todo el procesamiento ocurre en el
// navegador, así que no hay datos que proteger en el servidor.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/xmlscan/login')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const esperado = await expectedToken();

  if (esperado && cookie && cookie === esperado) {
    return NextResponse.next();
  }

  // Sin sesión válida → al login, recordando a dónde quería ir.
  const url = req.nextUrl.clone();
  url.pathname = '/xmlscan/login';
  url.search = '';
  if (pathname !== '/xmlscan') {
    url.searchParams.set('from', pathname);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/xmlscan', '/xmlscan/:path*'],
};
