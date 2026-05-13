import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Procesador XML Sovos',
  description: 'Procesa XML de facturas chilenas y exporta a Excel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
