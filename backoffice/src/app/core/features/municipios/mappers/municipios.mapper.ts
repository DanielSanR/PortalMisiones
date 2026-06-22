import { MunicipalityResponseDTO } from '../models/municipio.dto';
import { MunicipioVM } from '../models/municipio.vm';

/** DTO del backend → ViewModel de municipio. */
export function toMunicipioVM(dto: MunicipalityResponseDTO): MunicipioVM {
  return { id: dto.id, nombre: dto.name, codigoPostal: dto.postalCode };
}
