/** Superficie pública del feature plantillas (plantilla provincial de trámite, `ProcedureTemplate`). */
export { PlantillasFacade } from './facades/plantillas.facade';
// Consumido cross-feature por adopciones (título de la plantilla y opciones del diálogo "Adoptar").
export { PlantillasRepository } from './repositories/plantillas.repository';
export type {
  PlantillaVM, PlantillaRef, PlantillaFormValue, PlantillaFormData, PlantillaCatalogos, PlantillaOpcion,
} from './models/plantilla.vm';
export { providePlantillasFeature } from './plantillas.providers';
