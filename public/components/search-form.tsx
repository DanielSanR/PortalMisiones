import Link from 'next/link';
import { getEtiquetas, getModalidades, getOrganismos } from '@/lib/public-data';

interface SearchFormProps {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  etiquetaId?: number;
  compact?: boolean;
}

export function SearchForm({
  search,
  organismoId,
  modalidadId,
  etiquetaId,
  compact = false,
}: SearchFormProps) {
  const organismos = getOrganismos();
  const modalidades = getModalidades();
  const etiquetas = getEtiquetas();

  return (
    <form action="/tramites" className={compact ? 'filters' : 'search-form'}>
      {compact ? <h3>Filtrar catalogo</h3> : null}
      {compact ? (
        <p className="muted">Refina la busqueda por organismo, modalidad o tematica.</p>
      ) : null}
      <input className="field" type="search" name="search" placeholder="Buscar por tramite, organismo o tema" defaultValue={search} />
      <select className="field" name="organismoId" defaultValue={organismoId ?? ''}>
        <option value="">Todos los organismos</option>
        {organismos.map((organismo) => (
          <option key={organismo.id} value={organismo.id}>
            {organismo.nombre}
          </option>
        ))}
      </select>
      <select className="field" name="modalidadId" defaultValue={modalidadId?.toString() ?? ''}>
        <option value="">Todas las modalidades</option>
        {modalidades.map((modalidad) => (
          <option key={modalidad.id} value={modalidad.id}>
            {modalidad.nombre}
          </option>
        ))}
      </select>
      {compact ? (
        <>
          <select className="field" name="etiquetaId" defaultValue={etiquetaId?.toString() ?? ''}>
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.id}>
                {etiqueta.nombre}
              </option>
            ))}
          </select>
          <button className="cta" type="submit">
            Aplicar filtros
          </button>
          <Link className="secondary-action" href="/tramites">
            Limpiar filtros
          </Link>
        </>
      ) : (
        <button className="cta" type="submit">
          Buscar tramites
        </button>
      )}
    </form>
  );
}
