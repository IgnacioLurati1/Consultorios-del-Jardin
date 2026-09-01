/**
 * Turnos de demo para poder mirar el panel de números con algo adentro.
 *
 *   node scripts/seed-analytics.cjs          carga
 *   node scripts/seed-analytics.cjs --clean  borra lo que cargó
 *
 * Todo lo que inserta lleva la marca MARK al final de las observaciones, así el
 * --clean borra exactamente eso y nada más. No toca ningún turno real.
 *
 * Cubre los últimos 13 meses (los 12 cerrados que dibujan los gráficos, más lo que
 * va del mes en curso, que se ve en las tarjetas de arriba).
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

const MARK = "(demo)";
const DB = process.env.DATABASE_URL || "mysql://dsw:dsw@localhost:3306/gardenOfficedb";

const MONTHS_BACK = 12;
const VALUES = [4000, 5000, 6000, 7500, 9000, 12000];

const NOTES = [
  "Consulta de control.",
  "Se trabajó sobre los objetivos del mes.",
  "Continúa con el plan pautado.",
  "Se reprograma seguimiento.",
  "Primera consulta.",
];

// Generador determinista: dos corridas dan el mismo resultado.
let seed = 20260901;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const pick = (list) => list[Math.floor(rand() * list.length)];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function clean(connection) {
  const [result] = await connection.execute("DELETE FROM appointment WHERE observations LIKE ?", [`%${MARK}`]);
  console.log(`Borrados ${result.affectedRows} turnos de demo.`);
}

async function load(connection) {
  const [professionals] = await connection.query("SELECT email FROM person WHERE type = 'professional' AND active = 1");
  const [patients] = await connection.query("SELECT email FROM person WHERE type = 'client' AND active = 1");
  const [rooms] = await connection.query("SELECT id_room FROM room WHERE active = 1");

  if (!professionals.length || !patients.length || !rooms.length) {
    console.log("Faltan profesionales, pacientes o salas activas: no hay dónde colgar los turnos.");
    return;
  }

  // A cada profesional se le da un ritmo propio, para que las comparaciones del panel
  // del admin muestren diferencias y no tres columnas iguales.
  const profiles = professionals.map((professional, index) => ({
    email: professional.email,
    load: [1.6, 1.15, 0.75, 0.5][index % 4],
    overbookRate: [0.06, 0.13, 0.04, 0.08][index % 4],
    appRate: [0.7, 0.45, 0.6, 0.35][index % 4],
  }));

  const today = new Date();
  const rows = [];

  for (let back = MONTHS_BACK; back >= 0; back--) {
    const month = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const isCurrent = back === 0;

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // no se atiende el fin de semana
      if (isCurrent && date > today) continue; // el mes en curso llega hasta hoy

      // Martes y jueves cargan más, para que "día más cargado" diga algo.
      const busy = date.getDay() === 2 || date.getDay() === 4;

      for (const profile of profiles) {
        const slots = Math.round((busy ? 3.4 : 2.1) * profile.load * (0.6 + rand() * 0.8));

        for (let i = 0; i < slots; i++) {
          const hour = 8 + Math.floor(rand() * 11);
          const roll = rand();

          // Los meses cerrados ya están cerrados: casi todo asistido o cancelado. En el
          // mes en curso queda bastante "accepted" sin cerrar, que es lo normal.
          let state;
          if (roll < 0.11) state = new Date(date).toISOString(); // cancelado
          else if (roll < 0.18) state = "missed";
          else if (isCurrent && rand() < 0.55) state = "accepted";
          else if (!isCurrent && rand() < 0.08) state = "accepted"; // alguno que se olvidaron de cerrar
          else state = "assisted";

          rows.push([
            iso(date),
            `${pad(hour)}:00:00`,
            `${pad(hour + 1)}:00:00`,
            pick(VALUES),
            state,
            profile.email,
            pick(rooms).id_room,
            "sent",
            `${pick(NOTES)} ${MARK}`,
            pick(patients).email,
            rand() < profile.overbookRate ? 1 : 0,
            rand() < profile.appRate ? "patient" : "professional",
          ]);
        }
      }
    }
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      await connection.execute(
        `INSERT INTO appointment
           (date, initial_hour, final_hour, value, state, professional_email, room_id_room,
            reminder_sent, observations, patient_email, overbooked, origin)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        row
      );
      inserted++;
    } catch (error) {
      // El índice único (fecha, hora, profesional, estado) rebota los choques: se saltean.
      if (error.code !== "ER_DUP_ENTRY") throw error;
      skipped++;
    }
  }

  console.log(`Insertados ${inserted} turnos de demo (${skipped} salteados por choque de horario).`);
  console.log(`Para borrarlos: node scripts/seed-analytics.cjs --clean`);
}

(async () => {
  const connection = await mysql.createConnection(DB);

  try {
    if (process.argv.includes("--clean")) await clean(connection);
    else await load(connection);
  } finally {
    await connection.end();
  }
})();
