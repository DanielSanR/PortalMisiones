import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FICHAS_LOCALES_DS, FichasLocalesDataSource } from '../datasources/fichas-locales.datasource';
import { FichasLocalesFiltro } from '../models/ficha-local.dto';
import { FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../models/workflow';

/** Repositorio de fichas por localidad. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class FichasLocalesRepository {
  constructor(@Inject(FICHAS_LOCALES_DS) private ds: FichasLocalesDataSource) {}

  /** Capacidad de la fuente: ver `FichasLocalesDataSource.fuenteSimulada`. */
  get fuenteSimulada(): boolean {
    return this.ds.fuenteSimulada;
  }

  list(filtro?: FichasLocalesFiltro): Observable<FichaLocal[]> {
    return this.ds.list(filtro);
  }

  getById(id: string): Observable<FichaLocal> {
    return this.ds.getById(id);
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    return this.ds.create(form);
  }

  update(id: string, form: FichaLocalFormValue): Observable<FichaLocal> {
    return this.ds.update(id, form);
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
