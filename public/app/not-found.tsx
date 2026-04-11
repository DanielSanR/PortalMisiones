import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="shell">
      <section className="empty-state">
        <span className="eyebrow" style={{ background: 'rgba(13, 107, 69, 0.08)', color: '#08452d' }}>
          Tramite no encontrado
        </span>
        <h1>La ficha que buscabas no esta disponible.</h1>
        <p className="muted">
          Puede que el tramite todavia no este publicado o que el enlace haya cambiado.
        </p>
        <div className="tags" style={{ justifyContent: 'center' }}>
          <Link className="tag" href="/">
            Ir al inicio
          </Link>
          <Link className="tag" href="/tramites">
            Ver catalogo
          </Link>
        </div>
      </section>
    </main>
  );
}
