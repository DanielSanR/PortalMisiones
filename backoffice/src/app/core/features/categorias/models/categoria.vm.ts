/** ViewModel de Categoría (plano) — BACKEND_API_SPEC.md §5.3. */
export interface CategoriaVM {
  id: string; // UUID
  parentId: string | null;
  slug: string;
  nombre: string;
}

/** Nodo del árbol jerárquico (profundidad arbitraria: `children` es recursivo). */
export interface CategoriaNode extends CategoriaVM {
  children: CategoriaNode[];
}

/** Valor del formulario de categoría. `parentId` null = categoría raíz. */
export interface CategoriaFormValue {
  parentId: string | null;
  slug: string;
  nombre: string;
}
