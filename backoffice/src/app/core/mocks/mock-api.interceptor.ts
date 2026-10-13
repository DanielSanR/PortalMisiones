import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, delay, of, switchMap, throwError, timer } from 'rxjs';
import { MOCK_USUARIOS, paginate } from './mock-data';
import { Usuario, UsuarioCreate, UsuarioUpdate } from '../models/usuario.model';

/**
 * Mock legado por interceptor. Tras la fase 5 de trámites (PLAN_TRAMITES_API.md) solo atiende
 * `/api/usuarios` (listado/edición de usuarios, que el backend real no expone y que usa
 * `UsuariosMockDataSource` / el híbrido `UsuariosHttpDataSource` vía `UsuarioService`). Los demás
 * features tienen su DataSource mock en memoria; todo lo que no matchea acá pasa al backend.
 */

const MOCK_DELAY = 300;

let usuarios = [...MOCK_USUARIOS];

/**
 * Un status >= 400 tiene que llegar como ERROR, no como respuesta exitosa.
 *
 * Antes esto devolvía siempre `of(new HttpResponse({ status }))`, y `HttpClient` solo
 * considera error lo que llega por el canal de error: un 404 del mock se entregaba como
 * éxito con `{ message: 'No encontrado' }` de body. El resultado es que NINGÚN camino de
 * "no encontrado" de la app podía dispararse contra datos mockeados —la pantalla mapeaba
 * ese body a un modelo vacío y dibujaba una ficha con guiones en vez de decir que el
 * recurso no existe—. Son 18 respuestas de error en este archivo, todas silenciadas.
 */
function jsonResponse(body: unknown, status = 200): Observable<HttpResponse<unknown>> {
  if (status >= 400) {
    // `delay` no demora la notificación de error (la deja pasar de largo), así que la
    // latencia simulada se consigue con un timer previo.
    return timer(MOCK_DELAY).pipe(
      switchMap(() => throwError(() => new HttpErrorResponse({ status, error: body }))),
    );
  }
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

  // ── Usuarios ────────────────────────────────────────────
  if (matchUrl(url, '/api/usuarios') && !matchUrl(url, '/api/usuarios/')) {
    if (method === 'GET') return jsonResponse(paginate(usuarios, 1, 100));
    if (method === 'POST') {
      const body = req.body as UsuarioCreate;
      const newUser: Usuario = {
        id: 'usr-' + Date.now(),
        email: body.email,
        nombre: body.nombre,
        apellido: body.apellido,
        rol: body.rol,
        organismoId: body.organismoId || null,
        localidadId: null,
        activo: true,
        createdAt: new Date().toISOString(),
        organismoNombre: '-',
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
        usuarios[idx] = { ...usuarios[idx], ...(req.body as UsuarioUpdate) };
        return jsonResponse(usuarios[idx]);
      }
    }
    if (method === 'DELETE') {
      const antes = usuarios.length;
      usuarios = usuarios.filter(u => u.id !== id);
      return usuarios.length < antes ? jsonResponse(null, 204) : jsonResponse({ message: 'No encontrado' }, 404);
    }
  }

  // ── Fallthrough ─────────────────────────────────────────
  return next(req);
};
