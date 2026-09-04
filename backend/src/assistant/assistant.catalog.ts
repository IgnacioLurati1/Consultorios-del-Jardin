/**
 * Lo que el asistente sabe del consultorio sin preguntarle a la base: los datos de
 * contacto y el mapa de pantallas de la aplicación.
 *
 * El mapa de pantallas existe para que el asistente pueda llevar a alguien a donde se
 * hace la cosa, en vez de explicarle en prosa dónde queda el botón. Cada entrada dice
 * qué roles la pueden abrir: el asistente propone, pero la ruta la protege el front y
 * ofrecerle a un paciente el panel de administración sería mandarlo a un cartel de
 * "no tenés permiso".
 */

export type Role = "client" | "professional" | "admin";

export const OFFICE_INFO = {
  name: "Consultorios del Jardín",
  address: "9 de Julio 3672",
  hours: "Lunes a viernes, de 9 a 20",
  mail: process.env.MAIL ?? "consultoriosjardinok@gmail.com",
  instagram: "@consultorios_jardin",
  specialities: ["Psicopedagogía", "Psicología", "Nutrición", "Fonoaudiología"],
};

export interface Page {
  /** Clave que usa el modelo. En español, porque es lo que va a querer escribir. */
  key: string;
  path: string;
  /** Cómo se llama el botón que ve la persona. */
  label: string;
  /** Para qué sirve. El modelo elige la pantalla leyendo esto. */
  description: string;
  roles: Role[];
}

export const PAGES: Page[] = [
  {
    key: "inicio",
    path: "/",
    label: "Ir al inicio",
    description: "Portada del consultorio.",
    roles: ["client", "professional", "admin"],
  },
  {
    key: "contacto",
    path: "/contacto",
    label: "Escribirnos",
    description: "Formulario para mandarle un mail al consultorio. Es la página de contacto.",
    roles: ["client", "professional", "admin"],
  },
  {
    key: "mis-datos",
    path: "/EditProfile",
    label: "Editar mis datos",
    description: "Datos personales de la cuenta: teléfono, documento, contraseña.",
    roles: ["client", "professional", "admin"],
  },
  {
    key: "pedir-turno",
    path: "/Appointment",
    label: "Pedir un turno",
    description: "Pantalla para sacar un turno eligiendo especialidad, profesional y horario.",
    roles: ["client", "professional", "admin"],
  },
  {
    key: "mis-turnos",
    path: "/AppointmentsList",
    label: "Ver mis turnos",
    description: "Lista de turnos propios, con la opción de cancelarlos.",
    roles: ["client", "professional"],
  },
  {
    key: "agenda",
    path: "/ProfessionalHome",
    label: "Ir a mi agenda",
    description: "Agenda del profesional: turnos del día, pendientes de aceptar y sobreturnos.",
    roles: ["professional", "admin"],
  },
  {
    key: "horarios",
    path: "/scheduleProfessional",
    label: "Ver los horarios",
    description: "Agenda semanal de cada profesional y ocupación de los consultorios.",
    roles: ["professional", "admin"],
  },
  {
    key: "mis-pacientes",
    path: "/Patients",
    label: "Ver mis pacientes",
    description: "Pacientes atendidos por el profesional y su historial.",
    roles: ["professional"],
  },
  {
    key: "mis-numeros",
    path: "/Analytics",
    label: "Ver mis números",
    description: "Los gráficos mes a mes del profesional. Para decirle un número puntual usá la herramienta; esta pantalla es para ver la evolución.",
    roles: ["professional"],
  },
  {
    key: "panel-admin",
    path: "/AdminHome",
    label: "Ir al panel",
    description: "Panel de administración, con accesos a todo lo demás.",
    roles: ["admin"],
  },
  {
    key: "usuarios",
    path: "/AdminHome/UsersAdmin",
    label: "Administrar usuarios",
    description: "Pacientes y profesionales: alta, edición y habilitación de cuentas.",
    roles: ["admin"],
  },
  {
    key: "alta-profesional",
    path: "/AdminHome/RegisterProfAdmin",
    label: "Dar de alta un profesional",
    description: "Formulario para registrar un profesional nuevo.",
    roles: ["admin"],
  },
  {
    key: "control",
    path: "/AdminHome/Control",
    label: "Abrir Control",
    description: "Consulta de solo lectura de los turnos de un profesional.",
    roles: ["admin"],
  },
  {
    key: "numeros-consultorio",
    path: "/AdminHome/Analytics",
    label: "Ver los números del consultorio",
    description: "Los gráficos del consultorio, mes a mes. Para decir un número puntual usá la herramienta; esta pantalla es para ver la evolución.",
    roles: ["admin"],
  },
  {
    key: "provincias",
    path: "/AdminHome/ProvincesAdmin",
    label: "Administrar provincias",
    description: "Alta, edición y baja de provincias.",
    roles: ["admin"],
  },
  {
    key: "localidades",
    path: "/AdminHome/CitiesAdmin",
    label: "Administrar localidades",
    description: "Alta, edición y baja de localidades, asociadas a una provincia.",
    roles: ["admin"],
  },
  {
    key: "sucursales",
    path: "/AdminHome/OfficesAdmin",
    label: "Administrar sucursales",
    description: "Sedes del consultorio, con su horario de apertura y cierre.",
    roles: ["admin"],
  },
  {
    key: "consultorios",
    path: "/AdminHome/RoomsAdmin",
    label: "Administrar consultorios",
    description: "Consultorios de atención dentro de cada sucursal.",
    roles: ["admin"],
  },
];

export function pagesFor(role: Role): Page[] {
  return PAGES.filter((page) => page.roles.includes(role));
}

export function findPage(key: string, role: Role): Page | undefined {
  const wanted = String(key ?? "")
    .trim()
    .toLowerCase();
  return pagesFor(role).find((page) => page.key === wanted);
}
