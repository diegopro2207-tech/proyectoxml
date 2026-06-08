import Link from 'next/link';

interface Project {
  href: string;
  name: string;
  description: string;
  tag?: string;
  locked?: boolean;
}

// Lista de proyectos del portafolio. Agregar uno nuevo = añadir un objeto aquí.
const PROJECTS: Project[] = [
  {
    href: '/xmlscan',
    name: 'XMLScan',
    description:
      'Procesador de XML de facturas electrónicas (DTE). Detecta propuestas, provisiones, VIN y conceptos, y exporta todo a Excel.',
    tag: 'Privado',
    locked: true,
  },
];

export default function Portfolio() {
  return (
    <main className="portfolio">
      <section className="portfolio-hero">
        <h1 className="portfolio-name">NexaProyects</h1>
        <p className="portfolio-sub">Proyects</p>
      </section>

      <section className="project-grid">
        {PROJECTS.map((p) => (
          <Link key={p.href} href={p.href} className="project-card">
            <div className="project-card-head">
              <span className="project-name">{p.name}</span>
              {p.tag && (
                <span className="project-tag">
                  {p.locked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                  {p.tag}
                </span>
              )}
            </div>
            <p className="project-desc">{p.description}</p>
            <span className="project-cta">
              Abrir
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}
      </section>

      <footer className="portfolio-foot">
        © {new Date().getFullYear()} NexaProyects
      </footer>
    </main>
  );
}
