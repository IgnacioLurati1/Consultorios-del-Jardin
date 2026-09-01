# App móvil — Consultorios del Jardín

La misma autogestión de turnos que la web, en React Native + Expo. Pega contra el **mismo
backend**: no hay un servidor aparte.

Para las decisiones de diseño y el árbol de pantallas, ver [MOBILE-DESIGN.md](./MOBILE-DESIGN.md).

## Levantarla

```bash
npm install
npm start
```

Y escanear el código QR con **Expo Go** desde el teléfono. El teléfono y la computadora
tienen que estar en la misma red.

El proyecto está en el **SDK 54**, que es el que corre el Expo Go de Play Store en el
teléfono con el que se probó. Expo Go solo ejecuta una versión de SDK: si algún día tira
"incompatible SDK version", hay que alinear el proyecto con la que diga la pantalla de
inicio de Expo Go (`npm install expo@~<version>.0.0` y después `npx expo install --fix`).

El backend tiene que estar corriendo aparte:

```bash
cd ../../Backend/DSW-Autogestora-de-turnos/backend
npm run build && npm start
```

### Cómo encuentra al backend

Sola, casi siempre: el teléfono ya se conectó al servidor de desarrollo, así que la app
saca de ahí la IP de la computadora y asume que el backend corre en el puerto 3000 del
mismo equipo (`src/api/config.ts`). Cambiar de red no rompe nada.

Si el backend está en otro lado, se pisa con un `.env` en esta carpeta:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

**Si el teléfono no conecta**, casi siempre es el firewall de Windows bloqueando el puerto
3000 para la red local. Hay que permitir Node.js en redes privadas.

## La sesión

El backend es uno solo y atiende a los dos clientes. Lo único que cambia es dónde puede
guardarse el refresh token:

- **La web** lo recibe en una cookie `httpOnly`, que el JavaScript de la página no puede
  leer. Esa es su defensa contra XSS.
- **La app** manda el header `X-Client: mobile`, así que lo recibe en el cuerpo de la
  respuesta y lo guarda en el llavero del sistema (`expo-secure-store`). Para renovar lo
  manda en `X-Refresh-Token`.

El backend acepta las dos formas y valida igual. Ver `backend/src/config/clients.ts`.

## Probar que la API responde

```bash
node scripts/verify-api.mjs
```

Repite contra el backend real todas las llamadas que hace la app, con los tres roles, y
avisa si alguna cambió de forma. Necesita los usuarios de demo cargados.

## Mirar las pantallas sin el teléfono

La app también corre en el navegador, solo para poder revisar el diseño mientras se
trabaja:

```bash
npx expo start --web --port 8082
node scripts/shoot.mjs shots professional     # o client, o admin
```

`shoot.mjs` entra con el usuario del rol, recorre sus pantallas y deja una foto de cada
una a 390 puntos de ancho, que es el celular más angosto que importa.

Ojo con qué prueba y qué no: en el navegador dibuja react-native-web, así que el
teclado, los gestos y el chrome del sistema **no** son los de verdad. Sirve para mirar
tipografía, espacios, copy y estados; no reemplaza abrirla en el teléfono.

Los tokens de sesión ahí van a `localStorage` (ver `src/api/secureStorage.web.ts`), que
es menos seguro que el llavero: por eso el navegador es una herramienta de trabajo y no
un destino de la app.

## Qué no está soportado

- **Web como destino real**: la sesión en el navegador queda en `localStorage`, y ni el
  calendario del sistema ni la vibración existen ahí. Para usar la aplicación desde una
  computadora está la web de verdad, en `../frontend`.
- **Compilar para las tiendas**: no hay configuración de EAS ni íconos propios todavía.
