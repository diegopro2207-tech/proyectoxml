import type { Metadata } from 'next';

// Rutas dinámicas: el middleware de sesión se evalúa en cada request y no se
// sirve una versión cacheada de /xmlscan ni del login.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'XMLScan',
  description: 'Procesador de XML de facturas electrónicas (DTE) con exportación a Excel.',
};

export default function XmlscanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
