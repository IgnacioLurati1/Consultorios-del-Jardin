# Diseño de la app — Consultorios del Jardín

Las decisiones que ya están tomadas. Antes de tocar una pantalla, leer esto: es lo que
evita que la pantalla número ocho parezca de otra aplicación.

## Qué es

Herramienta de gestión de turnos de un consultorio médico, con **tres audiencias en una
misma app**:

- **Paciente**: entra cada tanto, con una mano, para pedir un turno o ver cuándo es el
  próximo.
- **Profesional**: la usa todos los días. Quiere ver su agenda rápido y cerrar turnos.
- **Admin**: administra el catálogo y controla lo que se da. Es la audiencia más chica.

Plataformas: Android e iOS de primera. El navegador corre solo como herramienta de
trabajo, para mirar las pantallas sin el teléfono a mano (ver el README); no es un
destino de la app.

Identidad heredada de la web: el verde del consultorio, el papel claro, y Fraunces como
firma tipográfica.

## Los diales

- **Expresión: 5 de 10** — marca propia en el contenido, chrome del sistema. Las
  pestañas y los encabezados son los nativos: no hay barra inferior dibujada a mano.
- **Movimiento: 3 de 10** — transiciones del navegador y respuesta al toque. Nada
  decorativo. Es una app de trabajo que se abre para resolver algo.
- **Densidad: 5 de 10** — la agenda del profesional y las listas del admin son datos; las
  pantallas del paciente respiran más.

## La firma

El encabezado de Inicio (`components/DayBand.tsx`): fondo verde profundo, la fecha de hoy
en Fraunces y una sola frase que dice lo único que importa al abrir la app ("Hoy atendés a
cuatro personas"). Es el único lugar con ese fondo, y por eso se nota.

La otra decisión visible es lo que **no** se hizo: no hay una fila de tarjetas con
números arriba de cada pantalla, ni un cuadradito de color con ícono delante de cada fila.
Se agrupa con espacio y líneas finas.

## La barra de abajo

Cuatro lugares siempre, y el último siempre es **Más**. Los tres roles tienen más
funciones de las que entran, así que en vez de una barra distinta por rol, la forma es la
misma y cambia el contenido.

| Rol | Barra |
|---|---|
| Paciente | Inicio · Pedir · Turnos · Más |
| Profesional | Inicio · Agenda · Pacientes · Más |
| Admin | Inicio · Usuarios · Números · Más |

Lo que no entra en la barra sigue existiendo como ruta: se llega desde Más o desde los
accesos de Inicio.

## El árbol de pantallas

```
src/app/
  (auth)/            sin sesión; el grupo entero desaparece cuando hay una
    login            portada oscura, la única de la app
    registro        paciente o pedido para atender acá
    recuperar       manda el mail para elegir contraseña nueva
    contacto
  (app)/             con sesión; redirige al login si se cae
    (tabs)/          index · pedir-turno · turnos · pacientes · usuarios · numeros · mas
    turno/[num]      detalle, con lo que cada rol puede hacerle
    paciente/[email] ficha e historial
    pedir/index      elegir profesional
    pedir/[email]    horarios libres agrupados por día
    horarios         módulos de atención
    repeticiones     turnos que se generan solos
    nuevo-turno      alta desde el profesional (modal)
    nuevo-paciente   paciente sin cuenta (modal)
    mis-datos
    mis-numeros      los del profesional (se llama distinto que la pestaña del
                     admin: (tabs) es un grupo transparente y "numeros" chocaría)
    contacto
    asistente        el chat (modal)
    admin/           control · alta-profesional · provincias · localidades ·
                     sucursales · consultorios
```

Reglas que se respetan y conviene no romper:

- El corte de sesión vive en `_layout` de cada grupo, no adentro de las pantallas.
- Las pantallas de detalle tapan la barra de abajo: la barra son los cuatro lugares a los
  que se vuelve, todo lo demás es una tarea que empieza y termina.
- `Alert.alert` solamente para confirmar algo destructivo. Lo que salió bien se avisa con
  el cartel de `Feedback`, no con una ventana que haya que cerrar.

## Los tokens

Todo sale de `src/theme/tokens.ts`. Ninguna pantalla escribe un color.

- **Acento**: uno solo, el verde `#3b7658` (en modo oscuro se aclara a `#7fb494`, porque
  el de marca no contrasta sobre negro).
- **Grises**: una sola familia, fría.
- **Radios**: 8 / 12 / 16 / redondo, repartidos por rol.
- **Espacios**: escala de 4. El padding lateral de toda pantalla es 20.
- **Tocar**: nada por debajo de 44 puntos.
- **Tipografía**: Fraunces solo en títulos y fechas; el resto, la del sistema, que en un
  teléfono se lee mejor y acompaña el tamaño de letra que la persona eligió.
- **Modo oscuro**: sigue al del teléfono, sin interruptor propio.

## Cómo hablan las pantallas

Voseo rioplatense, igual que los mails y el asistente: "tenés", "podés", "fijate",
"avisame". Nunca "aquí tienes".

Los errores dicen qué pasó y qué hacer, y son los que manda el backend cuando los manda:
ya vienen escritos para leerse. Las pantallas vacías ofrecen la acción que las llena.

## Detalles que ya se corrigieron y conviene no volver a romper

- **Las fechas no llevan coma**: el formateador del sistema escribe "martes, 1 de
  septiembre"; en castellano va sin coma. Lo saca `longDate`.
- **La mayúscula va solo en la primera letra**: `textTransform: "capitalize"` la pone en
  todas las palabras y deja "Martes 1 De Septiembre". Para eso está `sentenceCase`.
- **"el hoy" no existe**: cuando el día entra en una frase se usa `onDay`, que devuelve
  "hoy", "mañana" o "el jueves 4 de septiembre".
- **Una acción destructiva no lleva flecha**: la flecha promete que lleva a otra
  pantalla, y cerrar sesión abre una confirmación.
- **Si el estado vacío ya ofrece la acción, no se repite abajo**: dos botones iguales en
  la misma pantalla se leen como un error.

## Lo que no está hecho

- No hay modo sin conexión: si no hay señal, cada pantalla muestra su error con un botón
  para reintentar, y nada más.
- No hay notificaciones push. Los avisos siguen siendo los mails que ya manda el backend.
- No se subió a ninguna tienda; el ícono de la app es todavía el del template.
