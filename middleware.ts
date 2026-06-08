import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

// Protege /xmlscan y sus subrutas. Si no hay cookie de sesión válida,
// redirige a la pantalla de login. La pantalla de login queda excluida
// para no entrar en un bucle de redirecciones.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // La pantalla de login siempre es accesible.
  if (pathname.startsWith('/xmlscan/login')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await expectedToken();

  if (expected && cookie && cookie === expected) {
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
