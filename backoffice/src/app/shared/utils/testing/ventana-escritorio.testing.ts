/**
 * Ventana de escritorio para medir alturas reales en specs.
 *
 * Karma corre en un iframe de ~750px de ancho: cae en el breakpoint `mobile` (<768) y ahí `_responsive.scss` fija
 * las filas de tabla en 48px. Para medir lo que ve la persona en escritorio, el nodo del fixture se muda a un iframe
 * del ancho pedido con copias de las hojas de estilo del documento (globales + las de los componentes ya creados):
 * las media queries se evalúan contra ese iframe. Angular sigue actualizando el nodo mudado con `detectChanges()`.
 *
 *   const ventana = await abrirVentanaEscritorio(fixture.nativeElement);
 *   ventana.densidadCompacta(true);
 *   … getBoundingClientRect() …
 *   ventana.cerrar();   // en afterEach
 */
export interface VentanaEscritorio {
  /** Pone o saca `densidad-compacta` en el `<html>` del iframe, como hace `PreferenciasService` en la app. */
  densidadCompacta(activa: boolean): void;
  /** Saca el iframe del documento. */
  cerrar(): void;
}

export async function abrirVentanaEscritorio(nodo: HTMLElement, ancho = 1280): Promise<VentanaEscritorio> {
  const iframe = document.createElement('iframe');
  iframe.width = String(ancho);
  iframe.height = '800';
  document.body.append(iframe);
  const doc = iframe.contentDocument!;

  const cargas: Promise<unknown>[] = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((hoja) => {
    // `instanceof` no sirve: la copia es de otro realm (el del iframe).
    const copia = doc.importNode(hoja, true) as HTMLElement;
    if (copia.nodeName === 'LINK') {
      cargas.push(new Promise((listo) => { copia.onload = listo; copia.onerror = listo; }));
    }
    doc.head.append(copia);
  });
  doc.body.append(doc.adoptNode(nodo));
  await Promise.all(cargas);

  return {
    densidadCompacta: (activa) => doc.documentElement.classList.toggle('densidad-compacta', activa),
    cerrar: () => iframe.remove(),
  };
}
