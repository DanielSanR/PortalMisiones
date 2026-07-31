ABM Roles:testeado y funcionando 
Editar Roles : no muestra el "active" del role
Si elimino un role que asigne a un usuario test3@... el login patea con error Tu usuario no tiene acceso al panel de administración, correcto.
ABM Recipients: testeado y funcionando
ABM Life events: testeado y funcionando
Alta usuario: testeado y funcionando

ABM Permisos : testeado y funcionando
Si agrego un permiso con mismo nombre, error 4062, correcto

ABM Usuarios desde SUPERADMIN only : Alta testeado y correcto
localidad desde Organismos carga correcto, no es modificable

ABM Categorias: testeado y funcionando
Testeo de profunidad arbitraria en sub three correcto
Si elimino una sub categoria con subs-categorias, error 4065, correcto
Si agrego una categoria con mismo slug, error 4072, correcto

ABM Modalidad:testeado y funcionando
Si agrego una modalidad con mismo nombre, error 4072, correcto

ABM Evento de vida: testeado y funcionando
Si agrego un evento de vida con mismo nombre, error 4072, correcto

ABM Organismos y Tipos de Organismo: testeado y funcionando
Si agrego un tipo de organismo con mismo nombre, error 4063, correcto
Si agrego un organismo con mismo acrónimo, error 5000, incorrecto, debería ser 4063
Si elimino/desactivo un tipo de organismo con organismos asignados, error 4066, correcto
Si elimino un organismo con organismos hijos asignados, error 4067, correcto
Si desactivo un organismo con organismos hijos asignados, sin error, correcto?
Al editar un organismo cuyo organismo padre esta desactivado, error 4071(conflicto 409), correcto.