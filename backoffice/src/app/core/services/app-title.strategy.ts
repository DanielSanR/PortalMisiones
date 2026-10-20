import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BreadcrumbDeclarado } from '../utils/breadcrumb.utils';

/** Sufijo fijo del `<title>`; también es el título completo cuando la ruta no declara breadcrumb. */
export const TITULO_APP = 'Backoffice Misiones';

/**
 * `<title>` por ruta: "<último tramo del breadcrumb> · Backoffice Misiones". El último tramo es el mismo texto
 * que el shell dibuja como `<h1>`, así pestaña, historial y lector de pantalla coinciden (WCAG 2.4.2).
 * Sin `data.breadcrumb` (Home) usa "Inicio" si la ruta es el home del dashboard; si no, el título de la app.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pagina = this.buildTitle(snapshot) ?? this.tituloDeBreadcrumb(snapshot);
    this.title.setTitle(pagina ? `${pagina} · ${TITULO_APP}` : TITULO_APP);
  }

  private tituloDeBreadcrumb(snapshot: RouterStateSnapshot): string | undefined {
    let ruta: ActivatedRouteSnapshot = snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    const declarado = ruta.data['breadcrumb'] as readonly BreadcrumbDeclarado[] | undefined;
    const ultimo = declarado?.[declarado.length - 1];
    if (ultimo) return typeof ultimo === 'string' ? ultimo : ultimo.label;
    return snapshot.url.startsWith('/dashboard/home') ? 'Inicio' : undefined;
  }
}
