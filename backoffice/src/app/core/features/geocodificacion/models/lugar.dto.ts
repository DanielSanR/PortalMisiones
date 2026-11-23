/**
 * Un resultado de `GET /search?format=jsonv2` de Nominatim (OpenStreetMap). Solo los campos que se usan:
 * `lat` / `lon` vienen como texto. Documentación: https://nominatim.org/release-docs/latest/api/Search/
 */
export interface NominatimLugarDTO {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  /** Categoría del objeto (`building`, `highway`, `place`…). */
  category?: string;
  type?: string;
}
