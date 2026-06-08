import type { Metadata } from 'next';

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
