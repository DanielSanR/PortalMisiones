QA manual — Usuarios contra la API real (BO-22) y códigos nuevos (BO-23)

▎ Precondición: `cd backoffice && npm run start:staging` (front en :4200 contra la API de staging), con la pestaña Network abierta.
▎ Entrá con el usuario SUPERADMIN de `e2e/.env`.
▎ ⚠️ Staging es compartido y estas acciones cambian datos reales. Para cambiar email, contraseña y estado usá solo
▎ el usuario de prueba `e2e.1792075066@example.com` (está inactivo). No toques las cuentas de daniel, sergio ni mariquena.

1. Lista de usuarios (Administración → Usuarios)

- [X] En Network hay un `GET /api/user` con 200. Ya no es el mock: aparecen los 4 usuarios reales de staging, no los de ejemplo.
- [X] El contador dice "4 usuarios" y los chips "Activos 3" e "Inactivos 1".
- [Z] La columna Usuario muestra el email una sola vez (sin la línea gris repetida abajo), con avatar de 2 letras. ( Tanto Usuario como Email muestran el mismo valor, que es el email del usuario.  - la api no devuelve el Username)
- [X] La columna Rol dice "Sin dato" en gris en todas las filas. ⚠️ Es esperado: el backend todavía manda el rol vacío (G-13). Antes mostraba "Agente" para todos, lo cual era falso.
- [X] La columna Organismo dice "Sin organismo" (mismo motivo).
- [X] El buscador filtra por email (probá con "sergio").
- [X] Ordenar por Email y por Cuenta desde los encabezados funciona. ( Funciona, pero al tercer click(volver al orden por default), no desaparece el arrow de ordenamiento)

2. Botón "Editar" (no disponible)

- [X] En cada fila, "Editar" se ve en gris pero se puede enfocar con Tab.
- [X] Al pasar el mouse, hacer foco o click aparece el tooltip "La edición de nombre, rol y organismo todavía no está disponible en el servidor". El click no navega.
- [X] Pegá a mano la URL `/dashboard/usuarios/editar/<id de cualquier usuario>`. Tiene que aparecer el banner "Edición no disponible" con el texto de ayuda y el botón "Volver a la lista", sin formulario y sin "Reintentar". "Volver a la lista" vuelve.

3. Menú "⋮" de la fila

- [X] Muestra: Cambiar email, Cambiar contraseña y Activar o Desactivar cuenta, según el estado.
- [X] NO muestra "Eliminar definitivamente". ⚠️ Esperado: en el backend siempre da 500 (G-13).
- [ ] En la fila de tu propia cuenta (la del SUPERADMIN con el que entraste) no aparecen Desactivar ni Eliminar.

4. Acciones de cuenta (solo sobre `e2e.1792075066@example.com`)

- [X] **Activar cuenta**: confirmar → `PUT /api/user/<id>/status-account` con body `{"accountActive": true}`, 2xx. La fila pasa a "Activa", el snackbar dice "Cuenta activada" y los chips se actualizan.
- [X] **Desactivar cuenta** (dejala como estaba): el body tiene que ser `{"accountActive": false}`, no un toggle. Fila "Inactiva".
- [X] Recargá la página (F5): el estado que ves coincide con el último que guardaste (o sea, quedó en el servidor).
- [X] **Cambiar contraseña**: probá primero una inválida (por ejemplo "abc") y el diálogo tiene que marcar la política: 8 a 20 caracteres, mayúscula, minúscula y número. Después una válida → `PUT .../change-password` 2xx, y el snackbar dice "Contraseña actualizada".
- [X] **Cambiar email**: poné un email con mayúsculas, por ejemplo `E2E.QA.Prueba@Example.com` → `PATCH .../change-email` 2xx. La fila lo muestra en minúsculas.
- [X] Recargá la página: el email nuevo sigue ahí.
- [X] (Opcional) **Cambiar contraseña de un SUPERADMIN o ADMIN_BACKOFFICE**: como el rol llega vacío, la acción aparece en todas las filas. Si lo probás sobre otra cuenta SA, esperá un 403 y que el diálogo muestre el error adentro, sin cerrarse ni dar un falso "Contraseña actualizada". ⚠️ Probalo solo si tenés una cuenta SA de prueba: si el backend lo aceptara, cambiaría una contraseña real.
DATO: 
al hacer hover en el icono de mostrar/ocultar contraseña agarra un hover medio gris y feo
No se utilizan los form components en varios /pages

5. Alta de usuario (regresión: no cambió, pero comparte el datasource)

- [X] "Nuevo usuario" abre el form y los roles cargan del backend.
- [X] (Opcional, deja un usuario más en staging) Crear uno `e2e.qa.<fecha>@example.com` → `POST /api/user` 2xx y aparece en la lista al volver.

6. Fichas: mensajes nuevos (con el mock de staging)

En staging, fichas va en mock, y el mock ya se comporta como el backend de `dev`.
- [ ] Trámites → Fichas por localidad → abrí una ficha "En revisión" y editá un texto (por ejemplo, costos). Guardar → la ficha sigue "En revisión" y no cambió de estado (R-1).
- [ ] Pegá la URL `/dashboard/tramites/fichas/detalle/no-existe` → "Esa ficha no existe", en vez del error genérico de carga "No pudimos cargar la ficha". Lo mismo con `/dashboard/tramites/fichas/editar/no-existe`.
- [ ] El flujo normal sigue igual: Borrador → Enviar a revisión → Publicar → Despublicar.

7. (Opcional) Códigos `4077` y `4091` contra el backend real

Solo si tenés el backend `dev` levantado en local (`npm run start:local`). En staging no se pueden reproducir.
- [ ] `4077`: abrí la misma ficha en Borrador en dos pestañas. En A, "Enviar a revisión" y después "Publicar". En B, sin recargar, "Enviar a revisión" → tiene que decir "La ficha cambió de estado y esta acción ya no corresponde. Recargá para ver su estado actual." (antes era un 500 genérico).
- `4091`: no se puede provocar desde la UI. El backend no expone `lockVersion` en el contrato, así que dos ediciones en pestañas distintas no chocan (G-8). El mensaje ya está listo para cuando lo expongan.

Lo que NO entra en este QA
- Rol, nombre y organismo en la lista de usuarios: dependen de G-13.
- Eliminar definitivamente y Editar usuario: no hay backend utilizable.
- Asignar rol a un usuario existente (BO-24): todavía no tiene pantalla.

---
Los 3 puntos con más chance de sorpresa (mirá primero estos):
1. Rol "Sin dato" en todas las filas: es correcto y viene del backend (G-13).
2. Activar/Desactivar: revisá en Network que el body sea el estado pedido y no un toggle.
3. La URL directa de edición tiene que bloquearse con "Edición no disponible".
