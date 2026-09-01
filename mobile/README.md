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

## Qué no está soportado

- **Web** (`npm run web`): `expo-secure-store` no existe en el navegador, así que no se
  puede iniciar sesión. Para eso está la web de verdad, en `../frontend`.
- **Compilar para las tiendas**: no hay configuración de EAS ni íconos propios todavía.
