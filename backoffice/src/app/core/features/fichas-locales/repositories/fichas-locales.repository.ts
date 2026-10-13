import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FICHAS_LOCALES_DS, FichasLocalesDataSource } from '../datasources/fichas-locales.datasource';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../models/workflow';

/**
 * Repositorio de fichas por localidad. Inyecta el DataSource vía token. Se exporta en el barrel para
 * que, cuando G-1 traiga el filtro por adopción, `AdopcionesFacade` pueda contar fichas sin depender
 * de `FichasLocalesFacade` (hoy nadie lo consume cross-feature).
 */
@Injectable({ providedIn: 'root' })
export class FichasLocalesRepository {
  constructor(@Inject(FICHAS_LOCALES_DS) private ds: FichasLocalesDataSource) {}

  list(): Observable<FichaLocal[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<FichaLocal> {
    return this.ds.getById(id);
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    return this.ds.create(form);
  }

  update(id: string, form: FichaLocalFormValue, estadoActual: EstadoFicha): Observable<FichaLocal> {
    return this.ds.update(id, form, estadoActual);
  }

  transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal> {
    return this.ds.transicion(id, transicion);
  }

  desactivar(id: string): Observable<void> {
    return this.ds.desactivar(id);
  }

  urlPublica(slug: string): string | null {
    return this.ds.urlPublica(slug);
  }
}
