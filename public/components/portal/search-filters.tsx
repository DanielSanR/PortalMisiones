import {
  getDestinatarios,
  getEtiquetas,
  getLocalidades,
  getModalidades,
  getOrganismos,
} from "@/lib/data/taxonomias"
import {
  SearchFiltersClient,
  type SearchFiltersClientProps,
} from "@/components/portal/search-filters-client"

type SearchFiltersProps = Omit<SearchFiltersClientProps, "catalogs">

/**
 * Server wrapper: resuelve los catálogos (organismos, modalidades, destinatarios,
 * localidades, etiquetas) en el server y los pasa como props al cliente.
 * En modo `hero` los catálogos no son necesarios y no se resuelven.
 */
export async function SearchFilters(props: SearchFiltersProps) {
  if (props.hero) {
    return <SearchFiltersClient {...props} />
  }

  const [organismos, modalidades, destinatarios, localidades, etiquetas] = await Promise.all([
    getOrganismos(),
    getModalidades(),
    getDestinatarios(),
    getLocalidades(),
    getEtiquetas(),
  ])

  return (
    <SearchFiltersClient
      {...props}
      catalogs={{ organismos, modalidades, destinatarios, localidades, etiquetas }}
    />
  )
}
