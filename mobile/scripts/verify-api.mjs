/**
 * Repite contra el backend real todas las llamadas que hace la app, con los tres roles.
 * No prueba la interfaz: prueba que cada endpoint que la app usa exista, acepte lo que
 * le manda y devuelva lo que espera leer.
 *
 *   node verify-api.mjs
 */
const BASE = process.env.API || "http://localhost:3000/api";

const USERS = {
  admin: { email: "admin@admin.com", password: "admin1234" },
  professional: { email: "luis.demo@demo.local", password: "demo1234" },
  client: { email: "paciente.demo@demo.local", password: "demo1234" },
};

let pass = 0;
let fail = 0;

function ok(name, extra = "") {
  pass++;
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
}

function bad(name, detail) {
  fail++;
  console.log(`  FALLA ${name} — ${detail}`);
}

async function call(path, { token, method = "GET", body, refresh } = {}) {
  const headers = { "X-Client": "mobile" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (refresh) headers["X-Refresh-Token"] = refresh;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 120) };
  }

  return { status: response.status, json, cookie: response.headers.get("set-cookie") };
}

/** Comprueba un endpoint: 200 y, si se pide, que la forma de la respuesta sea la esperada. */
async function check(name, path, options = {}, shape) {
  const { status, json } = await call(path, options);

  if (status !== (options.expect ?? 200)) {
    bad(name, `HTTP ${status} ${JSON.stringify(json).slice(0, 120)}`);
    return null;
  }

  const data = json.data ?? json;

  if (shape) {
    const problem = shape(data);
    if (problem) {
      bad(name, problem);
      return data;
    }
  }

  ok(name, Array.isArray(data) ? `${data.length} filas` : "");
  return data;
}

const isArray = (data) => (Array.isArray(data) ? null : `esperaba una lista, vino ${typeof data}`);
const has = (...keys) => (data) => {
  const target = Array.isArray(data) ? data[0] : data;
  if (!target) return null; // lista vacía: no hay forma que comprobar
  const missing = keys.filter((key) => !(key in target));
  return missing.length ? `faltan campos: ${missing.join(", ")}` : null;
};

async function signIn(role) {
  const { status, json, cookie } = await call("/people/login", { method: "POST", body: USERS[role] });

  if (status !== 200) throw new Error(`login ${role}: HTTP ${status} ${JSON.stringify(json)}`);
  if (!json.refreshToken) throw new Error(`login ${role}: no vino refreshToken en el cuerpo`);
  if (cookie) throw new Error(`login ${role}: mandó cookie a un cliente mobile`);

  return json;
}

async function run() {
  console.log(`\nBackend: ${BASE}\n`);

  /* ---------- sesión ---------- */
  console.log("Sesión (como la app)");
  const sessions = {};

  for (const role of Object.keys(USERS)) {
    try {
      sessions[role] = await signIn(role);
      ok(`login ${role}`, "token + refreshToken en el cuerpo, sin cookie");
    } catch (problem) {
      bad(`login ${role}`, problem.message);
    }
  }

  if (sessions.client) {
    const renewed = await call("/refreshToken", { refresh: sessions.client.refreshToken });
    if (renewed.status === 200 && renewed.json.token) ok("refresh por header X-Refresh-Token");
    else bad("refresh por header", `HTTP ${renewed.status} ${JSON.stringify(renewed.json)}`);

    const naked = await call("/refreshToken");
    if (naked.status === 401) ok("refresh sin token da 401");
    else bad("refresh sin token", `esperaba 401, dio ${naked.status}`);
  }

  /* ---------- paciente ---------- */
  if (sessions.client) {
    console.log("\nPaciente");
    const token = sessions.client.token;

    const mine = await check("mis turnos", "/appointments/patient/0?includeCancelled=false", { token }, isArray);
    await check("mis turnos con cancelados", "/appointments/patient/0?includeCancelled=true", { token }, isArray);

    if (mine?.length) {
      const num = mine[0].numAppointment;
      const one = await check(`turno #${num}`, `/appointments/${num}`, { token }, has("numAppointment", "professional", "room"));

      if (one && JSON.stringify(one).includes("$2b$")) bad("turno sin hash", "la respuesta trae el hash de la contraseña");
      else ok("turno sin hash de contraseña");
    }

    const offices = await check("sucursales activas", "/offices/active", { token }, isArray);
    const office = offices?.[0];

    if (office) {
      const pros = await check(
        "profesionales de la sucursal",
        `/people/professionals/office/${office.idOffice}`,
        { token },
        isArray
      );

      if (pros?.length) {
        const slots = await call("/appointments/getAppointments", {
          token,
          method: "POST",
          body: { professionalEmail: pros[0].email, office: String(office.idOffice) },
        });

        if (slots.status === 200 && Array.isArray(slots.json.data)) {
          const shape = slots.json.data[0];
          if (!shape) ok("horarios libres", "0 libres");
          else if (!("date" in shape && "initialHour" in shape && "finalHour" in shape))
            bad("horarios libres", `forma inesperada: ${Object.keys(shape).join(", ")}`);
          else ok("horarios libres", `${slots.json.data.length} libres`);
        } else bad("horarios libres", `HTTP ${slots.status}`);
      }
    }

    await check("mis datos", `/people/${encodeURIComponent(USERS.client.email)}`, { token }, has("email", "name", "surname"));
  }

  /* ---------- profesional ---------- */
  if (sessions.professional) {
    console.log("\nProfesional");
    const token = sessions.professional.token;
    const email = USERS.professional.email;
    const hoy = new Date().toISOString().slice(0, 10);

    await check("mis turnos", "/appointments/professional/0", { token }, isArray);
    await check("agenda del día", `/appointments/professional-range?from=${hoy}&to=${hoy}&includeCancelled=true`, { token }, isArray);
    await check("mis horarios", `/schedules/by-email/${encodeURIComponent(email)}`, { token }, isArray);
    await check("todos los pacientes", "/people/type/active/client", { token }, isArray);
    await check("mis pacientes", "/appointments/my-patients", { token }, isArray);
    await check("consultorios activos", "/rooms/active", { token }, isArray);
    await check("mis números", "/analytics/me", { token }, has("professional", "recent", "total", "months"));
    await check("repeticiones", "/recurrences", { token }, isArray);
    await check("historial de un paciente", `/appointments/medical-history/${encodeURIComponent(USERS.client.email)}`, { token }, isArray);
  }

  /* ---------- admin ---------- */
  if (sessions.admin) {
    console.log("\nAdmin");
    const token = sessions.admin.token;

    await check("usuarios", "/people/NoAdmin", { token }, isArray);
    await check("provincias", "/provinces", { token }, isArray);
    await check("provincias activas", "/provinces/active", { token }, isArray);
    await check("localidades", "/cities", { token }, isArray);
    await check("localidades activas", "/cities/active", { token }, isArray);
    await check("sucursales", "/offices", { token }, isArray);
    await check("consultorios", "/rooms", { token }, isArray);
    await check("números del consultorio", "/analytics/office", { token }, has("headcount", "recent", "total", "months"));
    await check("uso del asistente", "/analytics/assistant", { token }, has("mesEnCurso", "historico", "herramientas"));

    const pros = await check("profesionales activos", "/people/type/active/professional", { token }, isArray);

    if (pros?.length) {
      await check(
        "control de turnos",
        `/appointments/by-professional/${encodeURIComponent(pros[0].email)}/0`,
        { token },
        isArray
      );
      await check(
        "control, solo sobreturnos",
        `/appointments/by-professional/${encodeURIComponent(pros[0].email)}/0?kind=overbooked`,
        { token },
        isArray
      );
    }
  }

  /* ---------- permisos ---------- */
  console.log("\nPermisos");

  if (sessions.client) {
    const noPatients = await call("/appointments/my-patients", { token: sessions.client.token });
    if (noPatients.status === 403) ok("un paciente no ve la lista de pacientes de nadie");
    else bad("mis pacientes", `un paciente recibió HTTP ${noPatients.status}`);

    const denied = await call("/analytics/office", { token: sessions.client.token });
    if (denied.status === 403 || denied.status === 401) ok("un paciente no ve los números del consultorio", `HTTP ${denied.status}`);
    else bad("números del consultorio", `un paciente recibió HTTP ${denied.status}`);
  }

  console.log(`\n${pass} bien, ${fail} mal\n`);
  process.exit(fail ? 1 : 0);
}

run().catch((problem) => {
  console.error(problem);
  process.exit(1);
});
