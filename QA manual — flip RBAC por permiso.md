QA manual — flip RBAC por permiso

▎ Precondición: backend d800be0 corriendo en :8080, front en :4200, pestaña Network abierta. Necesitás usuarios reales de cada rol (mirá login.data.md). Por cada acción visible, confirmá que la respuesta es 2xx, no 403.

1. SUPERADMIN — el test "van juntos"

- [X] El menú NO está vacío y aparecen TODOS los ítems. (Si estuviera vacío, los códigos no matchearían — es la prueba clave del rename.)
- [X] ABM completo funciona en: Categorías, Modalidades, Eventos de Vida, Destinatarios, Organismos, Tipos de Organismo, Roles, Permisos, Usuarios (alta).
- [X] En Roles, la fila SUPERADMIN tiene Editar/Eliminar habilitados (sos SUPERADMIN).

2. ADMIN_BACKOFFICE — el rol donde se ven las trampas

- [Z] Organismos y Tipos de Organismo NO aparecen en el menú (el seed no le da permisos de organismo → trampa #1, esperado). Entrar por URL directa /dashboard/organismos/lista → redirige a Home.
- [X] Ve y puede CRUD: Categorías, Modalidades, Eventos de Vida, Destinatarios (tiene esos permisos en el seed).
- [X] Ve Roles y Permisos y puede gestionarlos (el backend los deja por rol). PERO en Roles, la fila SUPERADMIN tiene Editar/Eliminar deshabilitados con tooltip (no es SUPERADMIN → evita el 403 4029).
- [X] Ve Usuarios pero en modo lectura: sin botón "Nuevo usuario", sin lápiz de editar y sin el toggle "activo" (gestión de usuarios = SUPERADMIN en el front, por dependencia de READ_ORGANISM). ⚠️ Esto es una política del front más estricta que el backend — es intencional, no lo marques como bug.
- [X] Ve Reportes (tiene VIEW_

Lo que no entra en este QA (bloqueado por backend)

- Trámites/Variantes (sin controller), Etiquetas/Tags (sin controller — usa mock; el gating es aproximado con TAXONOMY), upload/storage.

---
Los 2 puntos con más chance de sorpresa (mirá primero estos):
1. ADMIN_BACKOFFICE sin Organismos en el menú (correcto, no regresión).
2. ADMIN_BACKOFFICE con Usuarios en solo-lectura (política del front, no del backend).