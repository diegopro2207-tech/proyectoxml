import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AUTH_COOKIE,
  PDFEXCEL_COOKIE,
  expectedToken,
  expectedTokenPdfExcel,
} from '@/lib/auth';

// Cada proyecto privado tiene su propia cookie, su propia contraseña y su
// propia pantalla de login. La del login queda excluida para no entrar en un
// bucle de redirecciones.
const PROYECTOS = [
  {
    base: '/xmlscan',
    cookie: AUTH_COOKIE,
    token: expectedToken,
  },
  {
    base: '/pdftoexcel',
    cookie: PDFEXCEL_COOKIE,
    token: expectedTokenPdfExcel,
  },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const proyecto = PROYECTOS.find((p) => pathname.startsWith(p.base));
  if (!proyecto) return NextResponse.next();

  // La pantalla de login siempre es accesible.
  if (pathname.startsWith(`${proyecto.base}/login`)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(proyecto.cookie)?.value;
  const esperado = await proyecto.token();

  if (esperado && cookie && cookie === esperado) {
    return NextResponse.next();
  }

  // Sin sesión válida → al login, recordando a dónde quería ir.
  const url = req.nextUrl.clone();
  url.pathname = `${proyecto.base}/login`;
  url.search = '';
  if (pathname !== proyecto.base) {
    url.searchParams.set('from', pathname);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/xmlscan', '/xmlscan/:path*', '/pdftoexcel', '/pdftoexcel/:path*'],
};
