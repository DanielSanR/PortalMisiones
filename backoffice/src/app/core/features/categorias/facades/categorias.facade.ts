import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { CategoriasRepository } from '../repositories/categorias.repository';
import { CategoriaFormValue, CategoriaNode, CategoriaVM } from '../models/categoria.vm';

/**
 * Deriva el árbol jerárquico de **profundidad arbitraria** a partir del listado plano (`parentId`
 * encadenado). Recursivo: cada nodo arma sus hijos, y estos los suyos. El backend garantiza que no
 * hay ciclos (§5.3, códigos 4074/4075), así que la recursión siempre termina.
 */
function buildCategoriaTree(list: CategoriaVM[]): CategoriaNode[] {
  const nodesOf = (parentId: string | null): CategoriaNode[] =>
    list
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: nodesOf(c.id) }));
  return nodesOf(null);
}

/**
 * Facade de Categorías. Expone Observables (async pipe; NO signals). Depende solo del repositorio.
 * `categorias$` = listado plano (para el select de padre); `arbol$` = jerarquía derivada (para la vista).
 */
@Injectable({ providedIn: 'root' })
export class CategoriasFacade {
  private readonly _categorias$ = new BehaviorSubject<CategoriaVM[]>([]);
  readonly categorias$ = this._categorias$.asObservable();

  /** Árbol jerárquico (raíces + hijos) derivado del listado plano. */
  readonly arbol$: Observable<CategoriaNode[]> = this.categorias$.pipe(map(buildCategoriaTree));

  constructor(private repo: CategoriasRepository) {}

  loadCategorias(): Observable<CategoriaVM[]> {
    return this.repo.list().pipe(tap((list) => this._categorias$.next(list)));
  }

  getById(id: string): Observable<CategoriaVM> {
    return this.repo.getById(id);
  }

  create(form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.repo.create(form).pipe(
      tap((c) => this._categorias$.next([...this._categorias$.value, c]))
    );
  }

  update(id: string, form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.repo.update(id, form).pipe(
      tap((updated) => this._categorias$.next(this._categorias$.value.map((c) => (c.id === id ? updated : c))))
    );
  }

  delete(id: string): Observable<void> {
    return this.repo.delete(id).pipe(
      tap(() => this._categorias$.next(this._categorias$.value.filter((c) => c.id !== id)))
    );
  }
}
