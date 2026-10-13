/** Superficie pública del feature plantillas (plantilla provincial de trámite, `ProcedureTemplate`). */
export { PlantillasFacade } from './facades/plantillas.facade';
export type {
  PlantillaVM, PlantillaRef, PlantillaFormValue, PlantillaFormData, PlantillaCatalogos, PlantillaOpcion,
} from './models/plantilla.vm';
export { providePlantillasFeature } from './plantillas.providers';
