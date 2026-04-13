import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import {
  MOCK_TRAMITES,
  MOCK_ORGANISMOS,
  MOCK_MODALIDADES,
  MOCK_ETIQUETAS,
  MOCK_USUARIOS,
  MOCK_DASHBOARD_METRICS,
  MOCK_TOP_TRAMITES,
  MOCK_TOP_BUSQUEDAS,
  MOCK_AUDITORIA,
  MOCK_TRAMITES_POR_ORGANISMO,
  MOCK_EVENTOS_DE_VIDA,
  MOCK_FEEDBACK,
  MOCK_FEEDBACK_STATS,
  MOCK_LOCALIDADES,
  paginate,
} from './mock-data';
import { Tramite } from '../models/tramite.model';

const MOCK_DELAY = 300;

let tramites = [...MOCK_TRAMITES];
let organismos = [...MOCK_ORGANISMOS];
let etiquetas = [...MOCK_ETIQUETAS];
let modalidades = [...MOCK_MODALIDADES];
let usuarios = [...MOCK_USUARIOS];
let eventosDeVida = [...MOCK_EVENTOS_DE_VIDA];

function jsonResponse(body: unknown, status = 200) {
  return of(new HttpResponse({ status, body })).pipe(delay(MOCK_DELAY));
}

function matchUrl(url: string, pattern: string): boolean {
  return url.includes(pattern);
}

/** Calcula los eventos de vida a los que pertenece un trámite, leyendo desde la fuente de verdad */
function getEventosDeVidaForTramite(tramiteId: string): { id: number; nombre: string }[] {
  return eventosDeVida
    .filter(e => e.tramites?.some(t => t.id === tramiteId))
    .map(e => ({ id: e.id, nombre: e.nombre }));
}

/** Sincroniza la asociación tramite↔eventoDeVida cuando se crean o editan trámites */
function syncEventosDeVida(tramiteId: string, tramiteTitulo: string, eventoDeVidaIds: number[]): void {
  eventosDeVida = eventosDeVida.map(e => {
    const shouldInclude = eventoDeVidaIds.includes(e.id);
    const alreadyIn = e.tramites?.some(t => t.id === tramiteId) ?? false;

    if (shouldInclude && !alreadyIn) {
      return {
        ...e,
        tramitesCount: (e.tramitesCount ?? 0) + 1,
        tramites: [...(e.tramites ?? []), { id: tramiteId, titulo: tramiteTitulo }],
      };
    }
    if (!shouldInclude && alreadyIn) {
      const tramites = (e.tramites ?? []).filter(t => t.id !== tramiteId);
      return { ...e, tramitesCount: tramites.length, tramites };
    }
    return e;
  });
}

function extractId(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  const method = req.method;

  // ── Auth ────────────────────────────────────────────────
  if (matchUrl(url, '/auth/login') && method === 'POST') {
    return jsonResponse({
      code: 200,
      message: 'Login exitoso',
      data: {
        token: 'eyJhbGciOiJIUzI1NiJ9.' +
          btoa(JSON.stringify({
            sub: 'admin@misiones.gob.ar',
            roles: 'ROLE_SUPERADMIN',
            userId: 'usr-1',
            nombre: 'Carlos',
            apellido: 'Fernández',
            organismoId: null,
            exp: Math.floor(Date.now() / 1000) + 86400,
            iat: Math.floor(Date.now() / 1000),
          })) +
          '.mock-signature',
      },
    });
  }

  // ── Trámites CRUD ───────────────────────────────────────
  if (matchUrl(url, '/api/tramites') && !matchUrl(url, '/api/tramites/')) {
    if (method === 'GET') {
      const params = req.params;
      let filtered = [...tramites];

      const search = params.get('search');
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(t =>
          t.titulo.toLowerCase().includes(q) ||
          t.resumen?.toLowerCase().includes(q)
        );
      }

      const organismoId = params.get('organismoId');
      if (organismoId) filtered = filtered.filter(t => t.organismoId === organismoId);

      const estado = params.get('estado');
      if (estado) filtered = filtered.filter(t => t.estado === estado);

      const localidadId = params.get('localidadId');
      if (localidadId) {
        const lid = Number(localidadId);
        filtered = filtered.filter(t => t.localidades?.some(l => l.id === lid));
      }

      const page = Number(params.get('page')) || 1;
      const pageSize = Number(params.get('pageSize')) || 10;

      return jsonResponse(paginate(filtered, page, pageSize));
    }

    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newTramite: Tramite = {
        id: 'tram-' + Date.now(),
        titulo: body['titulo'],
        slug: body['titulo'].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        resumen: body['resumen'],
        descripcionLarga: body['descripcionLarga'] || null,
        urlOficial: body['urlOficial'],
        organismoId: body['organismoId'],
        modalidadId: body['modalidadId'],
        icono: body['icono'] || 'description',
        estado: 'borrador',
        destacado: body['destacado'] || false,
        etiquetas: etiquetas.filter(e => body['etiquetaIds']?.includes(e.id)),
        localidades: MOCK_LOCALIDADES.filter(l => body['localidadIds']?.includes(l.id)).map(l => ({ id: l.id, nombre: l.nombre })),
        eventosDeVida: [],
        organismo: organismos.find(o => o.id === body['organismoId']),
        modalidad: modalidades.find(m => m.id === body['modalidadId']),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (body['eventoDeVidaIds']?.length) {
        syncEventosDeVida(newTramite.id, newTramite.titulo, body['eventoDeVidaIds']);
        newTramite.eventosDeVida = getEventosDeVidaForTramite(newTramite.id);
      }
      tramites.unshift(newTramite);
      return jsonResponse(newTramite, 201);
    }
  }

  // Tramite by ID operations
  if (matchUrl(url, '/api/tramites/') && !matchUrl(url, '/slug/')) {
    const id = extractId(url.split('?')[0]);

    if (method === 'GET') {
      const tramite = tramites.find(t => t.id === id);
      if (!tramite) return jsonResponse({ message: 'No encontrado' }, 404);
      return jsonResponse({ ...tramite, eventosDeVida: getEventosDeVidaForTramite(id) });
    }

    if (method === 'PUT') {
      const idx = tramites.findIndex(t => t.id === id);
      if (idx >= 0) {
        const body = req.body as Record<string, any>;
        tramites[idx] = {
          ...tramites[idx],
          ...body,
          etiquetas: body['etiquetaIds']
            ? MOCK_ETIQUETAS.filter(e => body['etiquetaIds'].includes(e.id))
            : tramites[idx].etiquetas,
          localidades: body['localidadIds'] !== undefined
            ? MOCK_LOCALIDADES.filter((l: { id: number; nombre: string }) => body['localidadIds'].includes(l.id)).map((l: { id: number; nombre: string }) => ({ id: l.id, nombre: l.nombre }))
            : tramites[idx].localidades,
          eventosDeVida: body['eventoDeVidaIds'] !== undefined
            ? (() => { syncEventosDeVida(id, tramites[idx].titulo, body['eventoDeVidaIds']); return getEventosDeVidaForTramite(id); })()
            : tramites[idx].eventosDeVida,
          organismo: body['organismoId']
            ? organismos.find(o => o.id === body['organismoId'])
            : tramites[idx].organismo,
          modalidad: body['modalidadId']
            ? modalidades.find(m => m.id === body['modalidadId'])
            : tramites[idx].modalidad,
          updatedAt: new Date().toISOString(),
        };
        return jsonResponse(tramites[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }

    if (method === 'DELETE') {
      tramites = tramites.filter(t => t.id !== id);
      return jsonResponse(null, 204);
    }

    if (method === 'PATCH') {
      const idx = tramites.findIndex(t => t.id === id);
      if (idx >= 0) {
        if (url.includes('/publicar')) tramites[idx] = { ...tramites[idx], estado: 'publicado', updatedAt: new Date().toISOString() };
        if (url.includes('/despublicar')) tramites[idx] = { ...tramites[idx], estado: 'despublicado', updatedAt: new Date().toISOString() };
        if (url.includes('/revision')) tramites[idx] = { ...tramites[idx], estado: 'revision', updatedAt: new Date().toISOString() };
        return jsonResponse(tramites[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }
  }

  // ── Organismos CRUD ─────────────────────────────────────
  if (matchUrl(url, '/api/organismos') && !matchUrl(url, '/api/organismos/')) {
    if (method === 'GET') return jsonResponse(paginate(organismos, 1, 100));
    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newOrg = { id: 'org-' + Date.now(), nombre: body['nombre'], sigla: body['sigla'] || null, logoUrl: body['logoUrl'] || null, sitioWeb: body['sitioWeb'] || null, parentId: body['parentId'] || null };
      organismos.push(newOrg);
      return jsonResponse(newOrg, 201);
    }
  }

  if (matchUrl(url, '/api/organismos/')) {
    const id = extractId(url);
    if (method === 'GET') {
      const org = organismos.find(o => o.id === id);
      return org ? jsonResponse(org) : jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'PUT') {
      const idx = organismos.findIndex(o => o.id === id);
      if (idx >= 0) {
        const body = req.body as Record<string, any>;
        organismos[idx] = { ...organismos[idx], ...body } as typeof organismos[0];
        return jsonResponse(organismos[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'DELETE') {
      organismos = organismos.filter(o => o.id !== id);
      return jsonResponse(null, 204);
    }
  }

  // ── Usuarios ────────────────────────────────────────────
  if (matchUrl(url, '/api/usuarios') && !matchUrl(url, '/api/usuarios/')) {
    if (method === 'GET') return jsonResponse(paginate(usuarios, 1, 100));
    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newUser = {
        id: 'usr-' + Date.now(),
        email: body['email'],
        nombre: body['nombre'],
        apellido: body['apellido'],
        rol: body['rol'],
        organismoId: body['organismoId'] || null,
        activo: true,
        createdAt: new Date().toISOString(),
        organismoNombre: organismos.find(o => o.id === body['organismoId'])?.sigla || '-',
      };
      usuarios.push(newUser);
      return jsonResponse(newUser, 201);
    }
  }

  if (matchUrl(url, '/api/usuarios/')) {
    const id = extractId(url);
    if (matchUrl(url, '/toggle-active')) {
      const realId = url.split('/').slice(-2, -1)[0];
      const idx = usuarios.findIndex(u => u.id === realId);
      if (idx >= 0) {
        usuarios[idx] = { ...usuarios[idx], activo: !usuarios[idx].activo };
        return jsonResponse(usuarios[idx]);
      }
    }
    if (method === 'GET') {
      const user = usuarios.find(u => u.id === id);
      return user ? jsonResponse(user) : jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'PUT') {
      const idx = usuarios.findIndex(u => u.id === id);
      if (idx >= 0) {
        usuarios[idx] = { ...usuarios[idx], ...(req.body as Record<string, any>) } as typeof usuarios[0];
        return jsonResponse(usuarios[idx]);
      }
    }
  }

  // ── Etiquetas CRUD ──────────────────────────────────────
  if (matchUrl(url, '/api/etiquetas') && !matchUrl(url, '/api/etiquetas/')) {
    if (method === 'GET') return jsonResponse(paginate(etiquetas, 1, 100));
    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newEtiqueta = {
        id: Date.now(),
        nombre: body['nombre'],
        slug: body['nombre'].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        categoria: body['categoria'] || 'Temática',
        icono: body['icono'] || 'label',
        color: body['color'] || '#607D8B',
        activo: true,
        tramitesCount: 0,
      };
      etiquetas.push(newEtiqueta);
      return jsonResponse(newEtiqueta, 201);
    }
  }

  if (matchUrl(url, '/api/etiquetas/')) {
    const id = Number(extractId(url));
    if (method === 'GET') {
      const etiqueta = etiquetas.find(e => e.id === id);
      return etiqueta ? jsonResponse(etiqueta) : jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'PUT') {
      const idx = etiquetas.findIndex(e => e.id === id);
      if (idx >= 0) {
        const body = req.body as Record<string, any>;
        etiquetas[idx] = { ...etiquetas[idx], ...body } as typeof etiquetas[0];
        return jsonResponse(etiquetas[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'DELETE') {
      etiquetas = etiquetas.filter(e => e.id !== id);
      return jsonResponse(null, 204);
    }
  }

  // ── Modalidades CRUD ────────────────────────────────────
  if (matchUrl(url, '/api/modalidades') && !matchUrl(url, '/api/modalidades/')) {
    if (method === 'GET') return jsonResponse(paginate(modalidades, 1, 100));
    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newModalidad = {
        id: Date.now(),
        nombre: body['nombre'],
        descripcion: body['descripcion'] || null,
        icono: body['icono'] || 'tune',
        color: body['color'] || '#607D8B',
        activo: true,
        tramitesCount: 0,
      };
      modalidades.push(newModalidad);
      return jsonResponse(newModalidad, 201);
    }
  }

  if (matchUrl(url, '/api/modalidades/')) {
    const id = Number(extractId(url));
    if (method === 'GET') {
      const modalidad = modalidades.find(m => m.id === id);
      return modalidad ? jsonResponse(modalidad) : jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'PUT') {
      const idx = modalidades.findIndex(m => m.id === id);
      if (idx >= 0) {
        const body = req.body as Record<string, any>;
        modalidades[idx] = { ...modalidades[idx], ...body } as typeof modalidades[0];
        return jsonResponse(modalidades[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'DELETE') {
      modalidades = modalidades.filter(m => m.id !== id);
      return jsonResponse(null, 204);
    }
  }

  // ── Eventos de Vida CRUD ────────────────────────────────
  if (matchUrl(url, '/api/eventos-de-vida') && !matchUrl(url, '/api/eventos-de-vida/')) {
    if (method === 'GET') return jsonResponse(paginate(eventosDeVida, 1, 100));
    if (method === 'POST') {
      const body = req.body as Record<string, any>;
      const newEvento = {
        id: Date.now(),
        nombre: body['nombre'],
        descripcion: body['descripcion'] || null,
        icono: body['icono'] || 'event',
        color: body['color'] || '#607D8B',
        activo: true,
        tramitesCount: body['tramiteIds']?.length ?? 0,
        tramites: tramites
          .filter(t => body['tramiteIds']?.includes(t.id))
          .map(t => ({ id: t.id, titulo: t.titulo })),
      };
      eventosDeVida.unshift(newEvento);
      return jsonResponse(newEvento, 201);
    }
  }

  if (matchUrl(url, '/api/eventos-de-vida/')) {
    const id = Number(extractId(url.split('?')[0].replace('/toggle-active', '')));

    if (matchUrl(url, '/toggle-active') && method === 'PATCH') {
      const idx = eventosDeVida.findIndex(e => e.id === id);
      if (idx >= 0) {
        eventosDeVida[idx] = { ...eventosDeVida[idx], activo: !eventosDeVida[idx].activo };
        return jsonResponse(eventosDeVida[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }

    if (method === 'GET') {
      const evento = eventosDeVida.find(e => e.id === id);
      return evento ? jsonResponse(evento) : jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'PUT') {
      const idx = eventosDeVida.findIndex(e => e.id === id);
      if (idx >= 0) {
        const body = req.body as Record<string, any>;
        eventosDeVida[idx] = {
          ...eventosDeVida[idx],
          ...body,
          tramitesCount: body['tramiteIds']?.length ?? eventosDeVida[idx].tramitesCount,
          tramites: body['tramiteIds']
            ? tramites.filter(t => body['tramiteIds'].includes(t.id)).map(t => ({ id: t.id, titulo: t.titulo }))
            : eventosDeVida[idx].tramites,
        };
        return jsonResponse(eventosDeVida[idx]);
      }
      return jsonResponse({ message: 'No encontrado' }, 404);
    }
    if (method === 'DELETE') {
      eventosDeVida = eventosDeVida.filter(e => e.id !== id);
      return jsonResponse(null, 204);
    }
  }

  // ── Localidades (solo lectura — datos maestros de API) ──
  if (matchUrl(url, '/api/localidades') && method === 'GET') {
    const params = req.params;
    let filtered = [...MOCK_LOCALIDADES];
    const search = params.get('search');
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.nombre.toLowerCase().includes(q) ||
        l.departamento.toLowerCase().includes(q)
      );
    }
    const dep = params.get('departamento');
    if (dep) filtered = filtered.filter(l => l.departamento === dep);
    return jsonResponse(paginate(filtered, 1, 100));
  }

  // ── Feedback Ciudadano ──────────────────────────────────
  if (matchUrl(url, '/api/feedback/stats')) return jsonResponse(MOCK_FEEDBACK_STATS);

  if (matchUrl(url, '/api/feedback') && !matchUrl(url, '/api/feedback/')) {
    if (method === 'GET') {
      const params = req.params;
      let filtered = [...MOCK_FEEDBACK];

      const search = params.get('search');
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(f =>
          f.tramiteTitulo?.toLowerCase().includes(q) ||
          f.organismoNombre?.toLowerCase().includes(q)
        );
      }

      const esUtil = params.get('esUtil');
      if (esUtil !== null && esUtil !== '') {
        filtered = filtered.filter(f => f.esUtil === (esUtil === 'true'));
      }

      const tramiteId = params.get('tramiteId');
      if (tramiteId) filtered = filtered.filter(f => f.tramiteId === tramiteId);

      const fechaDesde = params.get('fechaDesde');
      if (fechaDesde) filtered = filtered.filter(f => f.fechaFeedback >= fechaDesde);

      const fechaHasta = params.get('fechaHasta');
      if (fechaHasta) filtered = filtered.filter(f => f.fechaFeedback <= fechaHasta);

      filtered.sort((a, b) => b.fechaFeedback.localeCompare(a.fechaFeedback));

      const page = Number(params.get('page')) || 1;
      const pageSize = Number(params.get('pageSize')) || 10;
      return jsonResponse(paginate(filtered, page, pageSize));
    }
  }

  // ── Auditoría ───────────────────────────────────────────
  if (matchUrl(url, '/api/auditoria') && !matchUrl(url, '/api/auditoria/')) {
    if (method === 'GET') {
      const params = req.params;
      let filtered = [...MOCK_AUDITORIA];

      const search = params.get('search');
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(a =>
          a.tramiteTitulo?.toLowerCase().includes(q) ||
          a.usuarioNombre?.toLowerCase().includes(q)
        );
      }

      const accion = params.get('accion');
      if (accion) filtered = filtered.filter(a => a.accion === accion);

      const usuarioId = params.get('usuarioId');
      if (usuarioId) filtered = filtered.filter(a => a.usuarioId === usuarioId);

      const fechaDesde = params.get('fechaDesde');
      if (fechaDesde) filtered = filtered.filter(a => a.fechaAccion >= fechaDesde);

      const fechaHasta = params.get('fechaHasta');
      if (fechaHasta) filtered = filtered.filter(a => a.fechaAccion <= fechaHasta);

      filtered.sort((a, b) => b.fechaAccion.localeCompare(a.fechaAccion));

      const page = Number(params.get('page')) || 1;
      const pageSize = Number(params.get('pageSize')) || 10;

      return jsonResponse(paginate(filtered, page, pageSize));
    }
  }

  if (matchUrl(url, '/api/auditoria/')) {
    const id = Number(extractId(url));
    if (method === 'GET') {
      const entry = MOCK_AUDITORIA.find(a => a.id === id);
      return entry ? jsonResponse(entry) : jsonResponse({ message: 'No encontrado' }, 404);
    }
  }

  // ── Dashboard ───────────────────────────────────────────
  if (matchUrl(url, '/api/dashboard/metrics')) return jsonResponse(MOCK_DASHBOARD_METRICS);
  if (matchUrl(url, '/api/dashboard/top-tramites')) return jsonResponse(MOCK_TOP_TRAMITES);
  if (matchUrl(url, '/api/dashboard/top-busquedas')) return jsonResponse(MOCK_TOP_BUSQUEDAS);
  if (matchUrl(url, '/api/dashboard/auditoria')) return jsonResponse(MOCK_AUDITORIA);
  if (matchUrl(url, '/api/dashboard/tramites-por-organismo')) return jsonResponse(MOCK_TRAMITES_POR_ORGANISMO);

  // ── Fallthrough ─────────────────────────────────────────
  return next(req);
};
