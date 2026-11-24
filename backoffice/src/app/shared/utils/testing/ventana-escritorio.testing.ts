/**
 * Ventana de ancho fijo para medir alturas reales en specs.
 *
 * El viewport de Karma depende de la ventana del navegador (ChromeHeadless de `test:ci` mide ~750px y cae en el
 * breakpoint `mobile`, <768; un Chrome maximizado con `npm test` no). Para medir sin depender de eso, el nodo del
 * fixture se muda a un iframe del ancho pedido, en modo estándar (con doctype, como la app), con copias de las hojas
 * de estilo del documento (globales + las de los componentes ya creados): las media queries y `:root` se evalúan
 * contra ese iframe. Angular sigue actualizando el nodo mudado con `detectChanges()`.
 *
 *   const ventana = await abrirVentanaEscritorio(fixture.nativeElement);        // 1280px
 *   const movil = await abrirVentanaEscritorio(fixture.nativeElement, 375);     // mobile
 *   ventana.densidadCompacta(true);
 *   … getBoundingClientRect() …
 *   ventana.cerrar();   // en afterEach
 *
 * Límites: solo sirve para medir lo ya dibujado al abrir.
 * - Los estilos de componentes creados DESPUÉS (diálogos, contenido lazy de un `@if`) van al documento principal: no
 *   llegan al iframe.
 * - Los overlays de CDK, los listeners de `document:` y `document.activeElement` siguen en la página principal: no la
 *   uses para specs de foco ni de teclado global.
 */
export interface VentanaEscritorio {
  /** Pone o saca `densidad-compacta` en el `<html>` del iframe, como hace `PreferenciasService` en la app. */
  densidadCompacta(activa: boolean): void;
  /** Saca el iframe del documento. */
  cerrar(): void;
}

/** Tope para que una hoja de estilo colgada falle rápido y con un mensaje claro, no por timeout de Jasmine. */
const ESPERA_HOJA_MS = 3000;

function esperarHoja(hoja: HTMLElement): Promise<void> {
  return new Promise((listo, falla) => {
    const tope = setTimeout(
      () => falla(new Error(`ventana-escritorio: la hoja ${hoja.getAttribute('href')} no cargó en ${ESPERA_HOJA_MS}ms`)),
      ESPERA_HOJA_MS,
    );
    hoja.onload = () => { clearTimeout(tope); listo(); };
    hoja.onerror = () => { clearTimeout(tope); falla(new Error(`ventana-escritorio: la hoja ${hoja.getAttribute('href')} no cargó`)); };
  });
}

export async function abrirVentanaEscritorio(nodo: HTMLElement, ancho = 1280): Promise<VentanaEscritorio> {
  const iframe = document.createElement('iframe');
  iframe.width = String(ancho);
  iframe.height = '800';
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  // Sin doctype el iframe queda en quirks mode (BackCompat) y mide distinto que la app.
  doc.open();
  doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
  doc.close();
  if (doc.compatMode !== 'CSS1Compat') {
    iframe.remove();
    throw new Error(`ventana-escritorio: el iframe quedó en ${doc.compatMode}, no en modo estándar`);
  }

  const cargas: Promise<void>[] = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((hoja) => {
    // `instanceof` no sirve: la copia es de otro realm (el del iframe).
    const copia = doc.importNode(hoja, true) as HTMLElement;
    if (copia.nodeName === 'LINK') cargas.push(esperarHoja(copia));
    doc.head.append(copia);
  });
  doc.body.append(doc.adoptNode(nodo));
  try {
    await Promise.all(cargas);
  } catch (err) {
    iframe.remove();
    throw err;
  }

  return {
    densidadCompacta: (activa) => doc.documentElement.classList.toggle('densidad-compacta', activa),
    cerrar: () => iframe.remove(),
  };
}
