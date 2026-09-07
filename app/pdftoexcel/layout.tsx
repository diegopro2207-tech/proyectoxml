import type { Metadata } from 'next';

// Rutas dinámicas: el middleware de sesión se evalúa en cada request y no se
// sirve una versión cacheada de /pdftoexcel ni del login.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PDF to Excel',
  description:
    'Extrae servicios y honorarios de propuestas en PDF y los exporta a Excel.',
};

export default function PdfToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
