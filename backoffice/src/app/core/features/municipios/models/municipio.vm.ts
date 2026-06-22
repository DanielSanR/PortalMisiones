/** ViewModel de municipio/localidad (BACKEND_API_SPEC.md §5.1). */
export interface MunicipioVM {
  id: number; // PK numérica (Long), a diferencia del resto del dominio
  nombre: string;
  codigoPostal: string;
}
