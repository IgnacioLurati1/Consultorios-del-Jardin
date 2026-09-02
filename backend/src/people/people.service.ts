import { orm } from "../shared/db/orm.js";
import { Person } from "./people.entity.js";
import { EntityManager, RequiredEntityData } from "@mikro-orm/core";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Schedule } from "../schedule/schedules.entity.js";
import MailService from "../config/mailer.js";
import { button, escapeHtml, note, paragraph, title } from "../config/mailTemplate.js";
import { badRequest, conflict, forbidden } from "../shared/errors.js";
import type { ClientChannel } from "../config/clients.js";
import { startOfDay } from "../shared/dates.js";
import { SettingsService } from "../settings/settings.service.js";

dotenv.config();

const em = orm.em;

/** Tope de la presentación del profesional. Es de la pantalla que la muestra, no de la columna. */
const ABOUT_MAX = 600;

export class PeopleService {
  private mailService: MailService;

  constructor() {
    this.mailService = new MailService();
  }

  private validateDocNumber(docNumber: any): boolean {
    return !docNumber || /^\d+$/.test(String(docNumber));
  }

  private normalizePhoneNumber(phoneNumber: any): string {
    return String(phoneNumber).replace(/\D/g, "");
  }

  private validatePhoneNumber(phoneNumber: any): boolean {
    return !phoneNumber || /^\d{10}$/.test(this.normalizePhoneNumber(phoneNumber));
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
 
  async findAllPeople(): Promise<Person[]> {
    return await em.find(Person, {});
  }

  async findAllPerType(peopleType: string): Promise<Person[]> {
    return await em.find(Person, { type: peopleType });
  }

  async findAllPerTypeActive(peopleType: string): Promise<Person[]> {
    return await em.find(Person, { type: peopleType, active: true });
  }

  async findAllNoAdmin(): Promise<Person[]> {
    return await em.find(Person, { type: { $ne: "admin" } });
  }

  async findPersonByEmail(email: string, emT?: EntityManager): Promise<Person> {
    return (emT || em).findOneOrFail(Person, { email });
  }

  async findPersonOrNull(email: string): Promise<Person | null> {
    return em.findOne(Person, { email });
  }

  /**
   * ¿Se puede registrar una cuenta con este email? Un paciente anónimo no ocupa el
   * lugar: registrarse con su email lo convierte en cuenta real (ver createPerson).
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const person = await em.findOne(Person, { email });
    return !person || person.anonymous === true;
  }

  async findProfessionalsWithOffices(officeId?: number): Promise<any[]> {
    const filter: any = { person: { type: "professional", active: true } };
    if (officeId) filter.room = { office: { idOffice: officeId } };

    const schedules = await em.find(Schedule, filter, {
      populate: ["person", "room.office", "room.office.city"],
    });

    const map = new Map<string, any>();
    for (const s of schedules) {
      const email = s.person.email;
      if (!map.has(email)) {
        map.set(email, {
          email,
          name: s.person.name,
          surname: s.person.surname,
          speciality: s.person.speciality,
          offices: new Map<number, string>(),
        });
      }
      const office = s.room.office;
      map.get(email).offices.set(office.idOffice, {
        id: office.idOffice,
        name: office.description,
        city: office.city.nameCity,
      });
    }

    return Array.from(map.values()).map((p) => ({
      email: p.email,
      name: p.name,
      surname: p.surname,
      speciality: p.speciality,
      offices: Array.from(p.offices.values()),
    }));
  }

  async findProfesionalByOffice(officeId: number, speciality?: string): Promise<Person[]> {
    const query = em
      .createQueryBuilder(Schedule, "s")
      .select("p.*")
      .distinct()
      .join("s.person", "p")
      .join("s.room", "r")
      .join("r.office", "o")
      // `bookable` en false lo saca de acá y de ningún otro lado: es la búsqueda que hace
      // un paciente para sacar turno. El admin lo sigue viendo entero en sus pantallas.
      .where({ "o.idOffice": officeId, "p.type": "professional", "p.active": true, "p.bookable": true });

    if (speciality) {
      query.andWhere({ "p.speciality": speciality });
    }

    // De licencia no se ofrece. A diferencia de `bookable`, que es una decisión que se
    // mantiene, esto se cae solo el día que vuelve: nadie tiene que acordarse de
    // volver a prenderlo.
    const onVacation = await new SettingsService().onVacationToday();

    if (onVacation.length > 0) query.andWhere({ "p.email": { $nin: onVacation } });

    return await query.execute();
  }

  private validateCommonFields(data: Partial<Person>) {
    if (!this.validateDocNumber(data.docNumber))
      throw badRequest("El número de documento debe contener solo dígitos");
    if (!this.validatePhoneNumber(data.phoneNumber))
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15 (ej: 3411234567)");
    if (data.email && !this.validateEmail(data.email))
      throw badRequest("El email no tiene un formato válido");
    if (data.about && data.about.trim().length > ABOUT_MAX)
      throw badRequest(`La presentación no puede pasar de ${ABOUT_MAX} caracteres`);
  }

  async createPerson(data: RequiredEntityData<Person>) {
    if (data.phoneNumber)
      data.phoneNumber = this.normalizePhoneNumber(data.phoneNumber);

    this.validateCommonFields(data as Partial<Person>);

    const hashedPassword = await bcrypt.hash(data.password as string, 10);

    // Si ya existe un paciente anónimo con ese email, no es un duplicado: es la misma
    // persona dándose de alta. Se convierte en cuenta real y conserva sus turnos y
    // observaciones, porque el email es la PK y no cambia.
    const existing = await em.findOne(Person, { email: data.email as string });

    if (existing) {
      if (!existing.anonymous) throw conflict("Ya hay una cuenta registrada con ese email");

      em.assign(existing, {
        ...data,
        password: hashedPassword,
        anonymous: false,
        active: true,
      });
      await em.flush();
      await this.sendWelcomeEmail(existing);
      return existing;
    }

    const person = em.create(Person, { ...data, password: hashedPassword, anonymous: false });
    await em.flush();
    await this.sendWelcomeEmail(person);
    return person;
  }

  // Paciente cargado por un profesional, sin cuenta ni contraseña.
  async createAnonymousPatient(data: {
    email: string;
    name: string;
    surname: string;
    docType?: string;
    docNumber?: string;
    phoneNumber?: string;
    /** Profesional que lo está cargando. Se guarda para saber quién lo dio de alta. */
    createdBy: string;
  }) {
    const phoneNumber = data.phoneNumber ? this.normalizePhoneNumber(data.phoneNumber) : "";

    if (!data.email || !this.validateEmail(data.email)) throw badRequest("El email no tiene un formato válido");
    if (!data.name?.trim() || !data.surname?.trim()) throw badRequest("El nombre y el apellido son obligatorios");
    if (data.docNumber && !this.validateDocNumber(data.docNumber))
      throw badRequest("El número de documento debe contener solo dígitos");
    if (phoneNumber && !this.validatePhoneNumber(phoneNumber))
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15 (ej: 3411234567)");

    const existing = await em.findOne(Person, { email: data.email });
    if (existing)
      throw conflict(
        existing.anonymous
          ? "Ya cargaste un paciente con ese email"
          : "Ese email ya pertenece a una cuenta registrada: buscá a la persona en la lista en vez de cargarla de nuevo"
      );

    const person = em.create(Person, {
      email: data.email,
      name: data.name.trim(),
      surname: data.surname.trim(),
      docType: data.docType || "DNI",
      docNumber: data.docNumber || "",
      phoneNumber,
      password: null,
      speciality: null as any,
      type: "client",
      active: true,
      // Solo significa algo en un profesional, pero la columna no admite nulos.
      bookable: true,
      autoAccept: false,
      autoMarkWhen: "appointment" as const,
      anonymous: true,
      createdBy: data.createdBy,
    });

    await em.flush();
    return person;
  }

  private async sendWelcomeEmail(person: Person) {
    const name = person.name ? `, ${escapeHtml(person.name)}` : "";

    const htmlContent = [
      title(`Bienvenido/a${name}`),
      paragraph("Tu cuenta ya está lista. Desde ahora podés pedir turno con cualquiera de nuestros profesionales, ver los horarios que tienen libres y cancelar sin llamar por teléfono."),
      paragraph("Cuando pidas un turno te vamos a escribir a este mismo mail: primero para avisarte que el profesional lo confirmó, y después el día anterior como recordatorio."),
      button("Pedir mi primer turno", `${process.env.BASE_URL ?? ""}/Appointment`),
      note("Si no fuiste vos quien creó esta cuenta, ignorá este mensaje y no vamos a volver a escribirte."),
    ].join("");

    const message = await this.mailService.createMessage(
      person.email,
      "Bienvenido/a a Consultorios del Jardín",
      htmlContent
    );
    await this.mailService.sendMail(message);
  }

  async createPersonTokens(personEmail: string, personType: string) {
    const token = jwt.sign({ email: personEmail, type: personType }, process.env.JWT_SECRET as jwt.Secret, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ email: personEmail, type: personType }, process.env.REFRESH_SECRET as jwt.Secret, {
      expiresIn: "30d",
    });

    return { token, refreshToken };
  }

  /**
   * Deja la marca de que esta persona entró hoy por este canal.
   *
   * Se llama al iniciar sesión y al renovar el token. El segundo es el que importa: una
   * sesión dura treinta días, así que contar solo los logins diría que casi nadie usa la
   * app. Renovar el token es lo más cerca que estamos de "la abrió".
   *
   * Solo escribe cuando cambia el día. El token se renueva cada quince minutos y la
   * fecha se usa para contar personas, no visitas: una fila por persona y por día alcanza
   * y saca del medio un UPDATE por request.
   *
   * Nunca hace fallar lo que la llamó. Es un dato de color para el panel de números; si
   * el UPDATE se cae, el login tiene que seguir andando igual.
   */
  async recordAccess(email: string, channel: ClientChannel): Promise<void> {
    try {
      const person = await em.findOne(Person, { email });
      if (!person) return;

      const field = channel === "app" ? "lastAppAccess" : "lastWebAccess";
      const previous = person[field];
      const now = new Date();

      if (previous && startOfDay(previous).getTime() === startOfDay(now).getTime()) return;

      person[field] = now;
      await em.flush();
    } catch (error) {
      console.error("No se pudo registrar el acceso:", error);
    }
  }

  /**
   * Muestra o esconde a un profesional de la búsqueda de turnos.
   *
   * No toca `active`: el profesional sigue entrando, viendo su agenda y cargando turnos.
   * Lo único que cambia es que deja de ofrecerse cuando alguien busca con quién atenderse.
   */
  async toggleBookable(email: string): Promise<Person> {
    const person = await em.findOneOrFail(Person, { email });

    if (person.type !== "professional") throw badRequest("Esto es solo para profesionales");

    person.bookable = !person.bookable;
    await em.flush();
    return person;
  }

  async updatePerson(data: Partial<Person>, email: string) {
    const person = await em.findOneOrFail(Person, { email });

    if (data.phoneNumber) data.phoneNumber = this.normalizePhoneNumber(data.phoneNumber);
    this.validateCommonFields(data);

    if (data.name !== undefined && !String(data.name).trim()) throw badRequest("El nombre no puede quedar vacío");
    if (data.surname !== undefined && !String(data.surname).trim()) throw badRequest("El apellido no puede quedar vacío");

    em.assign(person, { ...data });
    await em.flush();
    return person;
  }

  async changePassword(token: any, newPassword: string) {
    let email: string;

    try {
      const decodedToken = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret) as any;
      email = decodedToken.email;
    } catch (error: any) {
      throw new Error("Token expirado");
    }

    const person = await em.findOneOrFail(Person, { email });
    if (!person.active) throw new Error("USER_DISABLED"); // un usuario deshabilitado no puede cambiar su contraseña
    if (person.anonymous) throw new Error("ANONYMOUS_ACCOUNT"); // un paciente anónimo no tiene cuenta

    person.password = await bcrypt.hash(newPassword, 10);
    await em.flush();
  }

  async deletePersonRequest(email: string) {
    //El metodo permite eliminar un profesional siempre y cuando no este activo, es decir, sea una request. Si ya trabajo previamente, la bd tirara error y no lo permitira
    const person = await em.findOneOrFail(Person, { email });

    if (!person.active && person.type == "professional") {
      await em.removeAndFlush(person);
      return true;
    }

    return false;
  }

  async sendPasswordMail(email: string) {
    const changeToken = jwt.sign({ email }, process.env.CHANGE_SECRET as jwt.Secret, { expiresIn: "30m" });
    const url = `${process.env.BASE_URL}/reset-password?token=${changeToken}`;

    // Un botón y, abajo, el link en texto: hay clientes de correo que no muestran el
    // botón, y pegar la dirección a mano tiene que seguir siendo posible.
    const htmlContent = [
      title("Cambiá tu contraseña"),
      paragraph("Pediste una contraseña nueva para tu cuenta. Tocá el botón y elegí una:"),
      button("Elegir contraseña nueva", url),
      note(
        `¿No funciona el botón? Copiá esta dirección en el navegador:<br><a href="${url}" style="color:#2f5e46;word-break:break-all">${url}</a>`
      ),
      note(
        "El link vence en 30 minutos y sirve una sola vez. Si no pediste cambiarla, ignorá este mensaje: tu contraseña sigue siendo la de siempre."
      ),
    ].join("");

    const msg = await this.mailService.createMessage(email, "Cambiá tu contraseña", htmlContent);
    await this.mailService.sendMail(msg);
  }

  /**
   * Habilita o deshabilita una cuenta a mano.
   *
   * Deja anotado que fue el admin, y al volver a habilitar borra el motivo: si la cuenta
   * la había bajado el sistema y una persona decidió que estaba bien, esa decisión gana
   * y no tiene por qué seguir arrastrando la marca.
   */
  /**
   * Habilita o deshabilita una cuenta, dejando escrito quién lo hizo.
   *
   * `actorEmail` es el administrador que aprieta el botón. Importa en un solo caso, pero
   * importa mucho: una cuenta que el sistema cerró por parecer intervenida solo la puede
   * volver a abrir otra persona. En la práctica ya se cumple solo —una cuenta cerrada no
   * puede pedir nada, así que no puede levantarse a sí misma— pero dejarlo escrito acá
   * hace que siga siendo verdad si mañana alguien cambia cómo se autentica.
   */
  async toggleState(email: string, actorEmail?: string) {
    const person = await em.findOneOrFail(Person, { email });
    const active = !person.active;

    if (active && person.banKind === "compromise") {
      if (!actorEmail) throw forbidden("Para reabrir una cuenta cerrada por seguridad hace falta saber quién la reabre");

      if (actorEmail.toLowerCase() === email.toLowerCase()) {
        throw forbidden("Una cuenta cerrada por posible intrusión la tiene que revisar y reabrir otro administrador");
      }
    }

    em.assign(person, {
      ...person,
      active,
      bannedBy: active ? null : "admin",
      bannedAt: active ? null : new Date(),
      banReason: null,
      // Al reabrir, la marca de intrusión se guarda como resuelta: queda quién la
      // levantó y cuándo. Al cerrar a mano se limpia, porque pasa a ser otra cosa.
      banKind: null,
      clearedBy: active && person.banKind === "compromise" ? actorEmail ?? null : null,
      clearedAt: active && person.banKind === "compromise" ? new Date() : null,
    });

    await em.flush();

    if (active && person.clearedBy) {
      console.warn(`SEGURIDAD: ${person.clearedBy} volvió a habilitar a ${email}, cerrada por posible intrusión`);
    }

    return true;
  }
}
