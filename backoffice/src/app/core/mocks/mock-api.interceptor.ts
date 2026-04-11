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
  paginate,
} from './mock-data';
import { Tramite } from '../models/tramite.model';

const MOCK_DELAY = 300;

let tramites = [...MOCK_TRAMITES];
let organismos = [...MOCK_ORGANISMOS];
let usuarios = [...MOCK_USUARIOS];

function jsonResponse(body: unknown, status = 200) {
  return of(new HttpResponse({ status, body })).pipe(delay(MOCK_DELAY));
}

function matchUrl(url: string, pattern: string): boolean {
  return url.includes(pattern);
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
        etiquetas: MOCK_ETIQUETAS.filter(e => body['etiquetaIds']?.includes(e.id)),
        organismo: organismos.find(o => o.id === body['organismoId']),
        modalidad: MOCK_MODALIDADES.find(m => m.id === body['modalidadId']),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tramites.unshift(newTramite);
      return jsonResponse(newTramite, 201);
    }
  }

  // Tramite by ID operations
  if (matchUrl(url, '/api/tramites/') && !matchUrl(url, '/slug/')) {
    const id = extractId(url.split('?')[0]);

    if (method === 'GET') {
      const tramite = tramites.find(t => t.id === id);
      return tramite ? jsonResponse(tramite) : jsonResponse({ message: 'No encontrado' }, 404);
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
          organismo: body['organismoId']
            ? organismos.find(o => o.id === body['organismoId'])
            : tramites[idx].organismo,
          modalidad: body['modalidadId']
            ? MOCK_MODALIDADES.find(m => m.id === body['modalidadId'])
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

  // ── Catálogos ───────────────────────────────────────────
  if (matchUrl(url, '/api/modalidades')) return jsonResponse(MOCK_MODALIDADES);
  if (matchUrl(url, '/api/etiquetas')) return jsonResponse(MOCK_ETIQUETAS);

  // ── Dashboard ───────────────────────────────────────────
  if (matchUrl(url, '/dashboard/metrics')) return jsonResponse(MOCK_DASHBOARD_METRICS);
  if (matchUrl(url, '/dashboard/top-tramites')) return jsonResponse(MOCK_TOP_TRAMITES);
  if (matchUrl(url, '/dashboard/top-busquedas')) return jsonResponse(MOCK_TOP_BUSQUEDAS);
  if (matchUrl(url, '/dashboard/auditoria')) return jsonResponse(MOCK_AUDITORIA);

  // ── Fallthrough ─────────────────────────────────────────
  return next(req);
};
