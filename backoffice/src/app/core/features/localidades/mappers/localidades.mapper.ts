import { DepartmentResponseDTO, LocationResponseDTO } from '../models/localidad.dto';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

/** DTO backend → ViewModel de departamento. */
export function toDepartamentoVM(dto: DepartmentResponseDTO): DepartamentoVM {
  return { id: dto.id, nombre: dto.name };
}

/** DTO backend → ViewModel de localidad (resuelve el departamento desnormalizado). */
export function toLocalidadVM(dto: LocationResponseDTO): LocalidadVM {
  return {
    id: dto.id,
    nombre: dto.name,
    departamentoId: dto.departmentId,
    departamentoNombre: dto.departmentName,
  };
}
