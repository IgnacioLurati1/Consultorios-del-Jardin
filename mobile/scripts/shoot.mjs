/**
 * Recorre la app corriendo en el navegador y saca una foto de cada pantalla, a tamaño
 * de teléfono. Es la única forma de mirar el diseño sin tener el teléfono en la mano.
 *
 *   npx expo start --web --port 8082
 *   node scripts/shoot.mjs <carpeta> <rol>
 *
 * No reemplaza probarlo en el teléfono: acá el que dibuja es react-native-web, así que
 * el teclado, los gestos y el chrome del sistema no son los de verdad.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] || "shots";
const ROLE = process.argv[3] || "professional";
const BASE = "http://localhost:8082";

const USERS = {
  client: { email: "paciente.demo@demo.local", password: "demo1234" },
  professional: { email: "luis.demo@demo.local", password: "demo1234" },
  admin: { email: "admin@admin.com", password: "admin1234" },
};

/** Qué pantallas mirar por rol. El nombre del archivo es el de la foto. */
const TOURS = {
  client: [
    ["inicio", "/(app)/(tabs)"],
    ["pedir", "/(app)/(tabs)/pedir-turno"],
    ["turnos", "/(app)/(tabs)/turnos"],
    ["mas", "/(app)/(tabs)/mas"],
    ["mis-datos", "/(app)/mis-datos"],
    ["contacto", "/(app)/contacto"],
    ["asistente", "/(app)/asistente"],
  ],
  professional: [
    ["inicio", "/(app)/(tabs)"],
    ["agenda", "/(app)/(tabs)/turnos"],
    ["pacientes", "/(app)/(tabs)/pacientes"],
    ["mas", "/(app)/(tabs)/mas"],
    ["horarios", "/(app)/horarios"],
    ["repeticiones", "/(app)/repeticiones"],
    ["mis-numeros", "/(app)/mis-numeros"],
    ["nuevo-turno", "/(app)/nuevo-turno"],
    ["nuevo-paciente", "/(app)/nuevo-paciente"],
    ["pedir", "/(app)/pedir"],
  ],
  admin: [
    ["inicio", "/(app)/(tabs)"],
    ["usuarios", "/(app)/(tabs)/usuarios"],
    ["numeros", "/(app)/(tabs)/numeros"],
    ["mas", "/(app)/(tabs)/mas"],
    ["control", "/(app)/admin/control"],
    ["provincias", "/(app)/admin/provincias"],
    ["sucursales", "/(app)/admin/sucursales"],
    ["alta-profesional", "/(app)/admin/alta-profesional"],
    ["horarios", "/(app)/horarios"],
  ],
};

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const page = await context.newPage();
const problems = [];
page.on("pageerror", (error) => problems.push(String(error).slice(0, 200)));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error" && !text.includes("Download the React DevTools")) problems.push(text.slice(0, 200));
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Login
const user = USERS[ROLE];
const inputs = page.locator("input");
await inputs.nth(0).fill(user.email);
await inputs.nth(1).fill(user.password);
// Por el rol y no por el texto: el titulo de la pantalla tambien dice "Entrar".
await page.getByRole("button", { name: "Entrar" }).first().click();
await page.waitForTimeout(5000);

console.log("entró como", ROLE, "→", page.url());
await page.screenshot({ path: `${OUT}/00-login-hecho.png` });

let index = 1;
for (const [name, route] of TOURS[ROLE]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2600);

  const label = String(index).padStart(2, "0");
  await page.screenshot({ path: `${OUT}/${label}-${name}.png` });

  const text = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\s+/g, " "));
  console.log(`  ${label} ${name.padEnd(18)} ${text}`);
  index++;
}

if (problems.length) {
  console.log("\nERRORES EN CONSOLA:");
  [...new Set(problems)].slice(0, 8).forEach((problem) => console.log("  -", problem));
}

await browser.close();
