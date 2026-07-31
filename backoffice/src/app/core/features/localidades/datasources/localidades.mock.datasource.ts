import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { LocalidadesDataSource } from './localidades.datasource';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). Algunos departamentos/localidades de Misiones. */
@Injectable()
export class LocalidadesMockDataSource extends LocalidadesDataSource {
  private readonly departamentos: DepartamentoVM[] = [
    { id: 'dep-capital', nombre: 'Capital' },
    { id: 'dep-obera', nombre: 'Oberá' },
    { id: 'dep-eldorado', nombre: 'Eldorado' },
    { id: 'dep-iguazu', nombre: 'Iguazú' },
    { id: 'dep-apostoles', nombre: 'Apóstoles' },
    { id: 'dep-lnalem', nombre: 'Leandro N. Alem' },
  ];

  private readonly localidades: LocalidadVM[] = [
    { id: 'loc-posadas',  nombre: 'Posadas',       departamentoId: 'dep-capital',   departamentoNombre: 'Capital' },
    { id: 'loc-garupa',   nombre: 'Garupá',        departamentoId: 'dep-capital',   departamentoNombre: 'Capital' },
    { id: 'loc-obera',    nombre: 'Oberá',         departamentoId: 'dep-obera',     departamentoNombre: 'Oberá' },
    { id: 'loc-eldorado', nombre: 'Eldorado',      departamentoId: 'dep-eldorado',  departamentoNombre: 'Eldorado' },
    { id: 'loc-iguazu',   nombre: 'Puerto Iguazú', departamentoId: 'dep-iguazu',    departamentoNombre: 'Iguazú' },
    { id: 'loc-apostoles',nombre: 'Apóstoles',     departamentoId: 'dep-apostoles', departamentoNombre: 'Apóstoles' },
    { id: 'loc-lnalem',   nombre: 'Leandro N. Alem', departamentoId: 'dep-lnalem',  departamentoNombre: 'Leandro N. Alem' },
  ];

  getDepartamentos(): Observable<DepartamentoVM[]> {
    return of(this.departamentos.map((d) => ({ ...d }))).pipe(delay(DELAY));
  }

  getLocalidades(): Observable<LocalidadVM[]> {
    return of(this.localidades.map((l) => ({ ...l }))).pipe(delay(DELAY));
  }
}
