import { orm } from "../shared/db/orm.js";
import { Person } from "./people.entity.js";
import { EntityManager, RequiredEntityData } from "@mikro-orm/core";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Schedule } from "../schedule/schedules.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import MailService from "../config/mailer.js";
import { button, escapeHtml, featureCards, note, paragraph, sectionHead, title } from "../config/mailTemplate.js";
import { badRequest, conflict, forbidden, notFound } from "../shared/errors.js";
import type { ClientChannel } from "../config/clients.js";
import { startOfDay } from "../shared/dates.js";
import { SettingsService } from "../settings/settings.service.js";
import { visiblePatientsFilter } from "./patientVisibility.js";
import { PatientAccess } from "./patientAccess.entity.js";
import { assertDeliverableEmail } from "../shared/emailCheck.js";
import { deletionDateFor, purgeAccount } from "./accountCleanup.js";
import { bouncedEmails, hasBounced } from "./mailBounces.js";
import { movePatientEmail } from "./patientEmail.js";

dotenv.config();

const em = orm.em;

/** Tope de la presentación del profesional. Es de la pantalla que la muestra, no de la columna. */
const ABOUT_MAX = 600;

/** Mínimo de una contraseña nueva. El mismo que pide el registro en la pantalla. */
const MIN_PASSWORD = 6;

/**
 * Cuánto vale el link de bienvenida del profesional.
 *
 * Seis meses y no días: a los profesionales se les manda el link cuando se los da de alta,
 * pero muchos empiezan a usar el sistema semanas o meses después. Sirve una sola vez igual
 * (ver setFirstPassword), así que un link viejo no abre una cuenta que ya está en uso.
 */
const WELCOME_LINK_DAYS = 180;

/**
 * Cuánto vale el link de cambiar la contraseña que manda la administración.
 *
 * El que pide la persona desde "¿Olvidaste tu contraseña?" dura media hora, porque lo va a
 * abrir en el momento. El que manda la administración llega sin que nadie lo espere y se
 * abre cuando el profesional se hace un rato, así que dura lo mismo que la bienvenida.
 */
const ADMIN_RESET_DAYS = WELCOME_LINK_DAYS;

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

  /**
   * `viewer` es quién pregunta. Pidiendo pacientes, a un profesional no le llegan los sin
   * cuenta que cargó otro: ver canSeePatient.
   */
  async findAllPerTypeActive(peopleType: string, viewer?: { email: string; type: string }): Promise<Person[]> {
    const visible = peopleType === "client" && viewer ? await visiblePatientsFilter(viewer) : {};
    return await em.find(Person, { type: peopleType, active: true, ...visible });
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

  /**
   * Los profesionales que atienden, con las sucursales de cada uno.
   *
   * `onlyBookable` es para cuando quien pregunta es un paciente: al que la
   * administración sacó de la búsqueda no se lo nombra, porque nombrarlo termina en un
   * pedido de turno que el sistema rechaza y en una persona esperando una respuesta que
   * no va a llegar. El profesional y el administrador los ven a todos.
   */
  async findProfessionalsWithOffices(officeId?: number, onlyBookable = false): Promise<any[]> {
    const filter: any = { person: { type: "professional", active: true } };
    if (onlyBookable) filter.person.bookable = true;
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
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15, por ejemplo 3411234567");
    if (data.email && !this.validateEmail(data.email))
      throw badRequest("El email no tiene un formato válido");
    if (data.about && data.about.trim().length > ABOUT_MAX)
      throw badRequest(`La presentación no puede pasar de ${ABOUT_MAX} caracteres`);
  }

  /**
   * Da de alta una cuenta.
   *
   * `hashed` dice que la contraseña que viene ya está hasheada, que es el caso del alta
   * de paciente: ahí la contraseña se hashea al pedir el mail de validación y viaja así
   * adentro del token, para que el link nunca lleve la contraseña en claro.
   *
   * `invite` cambia el mail que sale: en lugar de la bienvenida, el link para elegir la
   * contraseña. Es el alta del profesional, que no eligió nada todavía porque la cuenta
   * se la creó el administrador. La bienvenida le llega después, cuando la elige.
   */
  /** Las direcciones que rebotaron, para que las pantallas marquen la fila. */
  async bouncedEmails(): Promise<string[]> {
    return bouncedEmails(em);
  }

  async createPerson(data: RequiredEntityData<Person>, hashed = false, options: { invite?: boolean } = {}) {
    if (data.phoneNumber)
      data.phoneNumber = this.normalizePhoneNumber(data.phoneNumber);

    this.validateCommonFields(data as Partial<Person>);

    // El alta del profesional la hace el administrador con un mail que escribió él, y de
    // ese mail depende que el profesional pueda entrar por primera vez. Quien se registra
    // solo no pasa por acá: prueba su mail abriendo el link (ver sendSignupMail).
    if (options.invite) {
      data.email = await assertDeliverableEmail(data.email);
      if (await hasBounced(em, data.email as string))
        throw badRequest("Ese correo no existe, ya rebotó una vez");
    }

    const hashedPassword = hashed ? (data.password as string) : await bcrypt.hash(data.password as string, 10);

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
      await (options.invite ? this.sendFirstPasswordMail(existing) : this.sendWelcomeEmail(existing));
      return existing;
    }

    const person = em.create(Person, { ...data, password: hashedPassword, anonymous: false });
    await em.flush();
    await (options.invite ? this.sendFirstPasswordMail(person) : this.sendWelcomeEmail(person));
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

    if (!data.name?.trim() || !data.surname?.trim()) throw badRequest("El nombre y el apellido son obligatorios");
    if (data.docNumber && !this.validateDocNumber(data.docNumber))
      throw badRequest("El número de documento debe contener solo dígitos");
    if (phoneNumber && !this.validatePhoneNumber(phoneNumber))
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15, por ejemplo 3411234567");

    // El mail tiene que existir de verdad, y va último porque es lo único que se pregunta
    // afuera. Es el único dato del paciente que el sistema usa para escribirle, y uno mal
    // escrito manda a la nada el turno y el recordatorio sin que nadie se entere. Si el
    // paciente no tiene correo o se prefiere el de otra persona, va ese en su lugar, que es
    // lo que dice la pantalla que lo carga.
    data.email = await assertDeliverableEmail(data.email);

    // Y si esa dirección ya rebotó alguna vez, no existe y no hay nada que discutir: lo
    // dijo el servidor de correo del otro lado. Es lo que corta volver a cargar el mismo
    // error después de borrar la ficha (ver mailBounces).
    if (await hasBounced(em, data.email))
      throw badRequest("Ese correo no existe, ya rebotó una vez");

    const existing = await em.findOne(Person, { email: data.email });
    if (existing) {
      if (!existing.anonymous)
        throw conflict("Ese email ya pertenece a una cuenta registrada. Buscá a la persona en la lista en vez de cargarla de nuevo");
      if (existing.createdBy === data.createdBy) throw conflict("Ya cargaste un paciente con ese email");

      // Lo cargó otro profesional. No se puede cargar de nuevo, porque el email es la clave,
      // y frenarlo con un error dejaba al segundo sin forma de darle turno. Sin decir nada,
      // desde ahí lo ve también, con los datos que cargó el primero: ver PatientAccess. Si
      // ya lo veía, no hay nada que agregar.
      const professional = await em.findOneOrFail(Person, { email: data.createdBy });
      if (!(await em.findOne(PatientAccess, { patient: existing, professional }))) {
        em.create(PatientAccess, { patient: existing, professional });
        await em.flush();
      }
      return { person: existing, alreadyLoaded: true };
    }

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
      waitlistEnabled: true,
      autoAccept: false,
      autoMarkWhen: "appointment" as const,
      autoPay: false,
      autoPayWhen: "appointment" as const,
      anonymous: true,
      createdBy: data.createdBy,
    });

    await em.flush();
    return { person, alreadyLoaded: false };
  }

  /**
   * La bienvenida, con lo que se puede hacer.
   *
   * Son dos mails y no uno. La misma función daba de alta pacientes y profesionales, así
   * que a quien venía a atender le llegaba "pedí turno con cualquiera de nuestros
   * profesionales", que no es lo que va a hacer con la cuenta.
   *
   * Lo que se lista es lo que hay en el menú de cada rol, y nada más. Prometer en un mail
   * algo que después no está en pantalla es peor que no explicar nada.
   */
  private async sendWelcomeEmail(person: Person) {
    const base = process.env.BASE_URL ?? "";
    const name = person.name ? `, ${escapeHtml(person.name)}` : "";
    const professional = person.type === "professional";

    const htmlContent = professional
      ? [
          title(`Bienvenido/a${name}`),
          paragraph("Tu cuenta de profesional ya está lista y tu agenda te está esperando."),
          sectionHead("Tu espacio", "Todo lo tuyo, a un toque"),
          featureCards([
            { title: "Turnos", text: "Tu agenda en grilla o en lista, con el estado y el paciente de cada turno." },
            { title: "Horarios", text: "Los módulos que atendés, en qué consultorio y cuánto dura cada turno." },
            { title: "Pacientes", text: "Con cuenta y sin cuenta, con su historial y tus observaciones." },
            { title: "Números", text: "Facturación, pacientes y carga de la agenda." },
            { title: "Los pedidos", text: "Confirmás o rechazás lo que piden. O dejás que se confirmen solos." },
            { title: "Pedir un turno", text: "También te podés atender vos, como cualquier paciente." },
          ]),
          button("Entrar a mi panel", `${base}/ProfessionalHome`),
          note("Todo esto está también en la aplicación del celular, con la misma cuenta."),
        ]
      : [
          title(`Bienvenido/a${name}`),
          paragraph("Tu cuenta ya está lista. La agenda está disponible a cualquier hora, sin llamar ni esperar a que abran."),
          sectionHead("Tu espacio", "Todo lo tuyo, a un toque"),
          featureCards([
            { title: "Pedir un turno", text: "Elegí especialidad, profesional y horario." },
            { title: "Mis turnos", text: "Los que tenés agendados y los que ya pasaron." },
            { title: "Cancelar", text: "Desde la misma pantalla, hasta el día anterior." },
            { title: "Mis datos", text: "Tu teléfono, tu mail y tu contraseña." },
          ]),
          button("Pedir mi primer turno", `${base}/Appointment`),
          note(
            "El día anterior al turno te escribimos un recordatorio, así no se te pasa. Todo esto está también en la " +
              "aplicación del celular, con la misma cuenta."
          ),
        ];

    const message = await this.mailService.createMessage(
      person.email,
      "Bienvenido/a a Consultorios del Jardín",
      [...htmlContent, note("Si no fuiste vos quien creó esta cuenta, ignorá este mensaje y no vamos a volver a escribirte.")].join("")
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

  /**
   * Prende o apaga la lista de espera de un profesional. Apagarla vacía la lista, pero eso
   * lo hace quien llama: acá solo se da vuelta la marca.
   */
  async toggleWaitlist(email: string): Promise<Person> {
    const person = await em.findOneOrFail(Person, { email });

    if (person.type !== "professional") throw badRequest("Esto es solo para profesionales");

    person.waitlistEnabled = !person.waitlistEnabled;
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
    let issuedAt: number;

    try {
      const decodedToken = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret) as any;
      // Los dos circuitos firman con la misma clave, así que lo que los separa es este
      // campo. Sin el corte, el link de "validá tu mail" —que lleva adentro los datos de
      // una cuenta que todavía no existe— serviría para cambiarle la contraseña a alguien.
      if (decodedToken.purpose) throw new Error("Token expirado");
      email = decodedToken.email;
      issuedAt = Number(decodedToken.iat) * 1000;
    } catch (error: any) {
      throw new Error("Token expirado");
    }

    const person = await em.findOneOrFail(Person, { email });
    if (!person.active) throw new Error("USER_DISABLED"); // un usuario deshabilitado no puede cambiar su contraseña
    if (person.anonymous) throw new Error("ANONYMOUS_ACCOUNT"); // un paciente anónimo no tiene cuenta

    // Un link sirve una sola vez, como dice el mail: si la contraseña cambió después de
    // firmarlo, ya se usó. Importa sobre todo con el que manda la administración, que
    // vale meses y quedaría abierto todo ese tiempo en la casilla de alguien.
    if (person.passwordSetAt && person.passwordSetAt.getTime() >= issuedAt) throw new Error("Token expirado");

    person.password = await bcrypt.hash(newPassword, 10);
    // Es el último cambio de contraseña, el que mira la administración para saber quién
    // sigue con la provisoria. También apaga el link de bienvenida: quien entró por acá ya
    // tiene la suya.
    person.passwordSetAt = new Date();
    await em.flush();
  }

  /**
   * Borra un paciente sin cuenta recién cargado.
   *
   * Es el deshacer del alta y no una baja. Un paciente con turnos es parte del historial
   * del consultorio y no se toca ni aunque no tenga cuenta; el que se puede borrar es el
   * que no llegó a tener ninguno, o sea el que se cargó sin querer o con el mail mal
   * escrito y hay que volver a cargar bien.
   *
   * Lo puede hacer el profesional que lo cargó, y nadie más. En cuanto la persona se
   * registra deja de ser anónima y la cuenta pasa a ser suya, así que tampoco.
   */
  async deleteAnonymousPatient(email: string, professionalEmail: string, options: { force?: boolean } = {}) {
    const person = await em.findOne(Person, { email });
    if (!person) throw notFound("No encontramos a esa persona");

    if (!person.anonymous || person.type !== "client")
      throw forbidden("Solo se puede borrar un paciente sin cuenta");
    if (person.createdBy !== professionalEmail) throw forbidden("Ese paciente lo cargó otro profesional");

    // El profesional puede deshacer un alta y puede borrar la ficha que quedó mal, que es
    // la del correo que rebotó. Una ficha sana con turnos es historial del consultorio, y
    // esa baja la decide la administración.
    if ((await em.count(Appointment, { patient: { email } })) > 0 && !(await hasBounced(em, email)))
      throw forbidden("El paciente ya tiene turnos, consultar a un administrador si desea borrarlo definitivamente");

    await this.assertNoAppointments(email, options.force);
    await purgeAccount(em, email);
    return true;
  }

  /**
   * Frena la baja de un paciente que tiene historial, salvo que ya se haya dicho que sí a
   * borrarlo entero.
   *
   * Cuenta los turnos de cualquier estado, cancelados incluidos: un turno cancelado sigue
   * siendo algo que pasó entre esas dos personas. El mensaje dice cuántos son, porque
   * "tiene turnos" y "tiene cuarenta turnos" no se deciden igual.
   *
   * `HAS_APPOINTMENTS` es lo que mira la pantalla para preguntar de nuevo, esta vez
   * diciendo qué se lleva puesto.
   */
  private async assertNoAppointments(email: string, force?: boolean) {
    if (force) return;

    const turnos = await em.count(Appointment, { patient: { email } });
    if (turnos === 0) return;

    throw conflict(
      `El paciente tiene ${turnos === 1 ? "un turno cargado" : `${turnos} turnos cargados`}`,
      "HAS_APPOINTMENTS"
    );
  }

  /**
   * Le cambia el correo a un paciente sin cuenta.
   *
   * Lo puede hacer la administración y el profesional que lo cargó, que son los mismos que
   * pueden borrarlo. El correo nuevo pasa por los mismos controles que un alta, porque un
   * arreglo que vuelve a escribir mal la dirección no arregla nada.
   *
   * El movimiento de todo lo que cuelga está en patientEmail.ts.
   */
  async changePatientEmail(email: string, newEmail: unknown, actor: { email: string; type: string }) {
    const person = await em.findOne(Person, { email });
    if (!person) throw notFound("No encontramos a esa persona");

    if (person.type !== "client" || !person.anonymous)
      throw forbidden("Solo se corrige el correo de un paciente sin cuenta");

    const isAdmin = actor.type === "admin";
    const isLoader = actor.type === "professional" && person.createdBy === actor.email;
    if (!isAdmin && !isLoader) throw forbidden("Ese paciente lo cargó otro profesional");

    const wanted = await assertDeliverableEmail(newEmail);

    if (wanted === person.email) throw badRequest("Es el correo que ya tiene");
    if (await hasBounced(em, wanted))
      throw badRequest("Ese correo no existe, ya rebotó una vez");
    if (await em.findOne(Person, { email: wanted }))
      throw conflict("Ya hay una persona con ese correo");

    return movePatientEmail(em, person, wanted);
  }

  /**
   * La baja de una persona que hace el administrador a mano.
   *
   * Solo un paciente. Un profesional no, porque arrastra agenda, horarios y alquileres, y
   * para eso está deshabilitar.
   *
   * Con turnos cargados hace falta decirlo dos veces (ver assertNoAppointments): ese
   * historial es del consultorio —quién vino, quién pagó, quién faltó— y se va con él.
   */
  async deletePerson(email: string, options: { force?: boolean } = {}) {
    const person = await em.findOneOrFail(Person, { email });

    if (person.type !== "client")
      throw forbidden("Solo se eliminan pacientes, el resto se deshabilita");

    await this.assertNoAppointments(email, options.force);
    await purgeAccount(em, email);
    return true;
  }

  /* ============================================================
     Alta de paciente con el mail validado
     ============================================================ */

  /**
   * Manda el link que da de alta la cuenta, y no da de alta nada.
   *
   * Sólo para pacientes. El profesional no se registra solo —lo carga el administrador— y
   * el administrador tampoco, así que la validación no tendría a quién validarle nada.
   *
   * Los datos viajan adentro del token y no quedan guardados en ningún lado. Es lo que
   * hace que una dirección que nadie confirmó no deje una fila esperando en la base, y que
   * un pedido abandonado desaparezca solo a los treinta minutos sin que haya que limpiar
   * nada. La contraseña viaja hasheada: el contenido de un token se lee sin la clave, así
   * que mandarla en claro sería mandarla escrita en el mail.
   *
   * Se valida todo acá y no al confirmar, aunque al confirmar se valide igual. Enterarse
   * de que el teléfono estaba mal después de ir al correo y volver es la peor forma
   * posible de enterarse.
   */
  async sendSignupMail(data: {
    email: string;
    name: string;
    surname: string;
    docType?: string;
    docNumber?: string;
    phoneNumber?: string;
    password: string;
  }) {
    const email = String(data.email ?? "").trim().toLowerCase();
    const phoneNumber = data.phoneNumber ? this.normalizePhoneNumber(data.phoneNumber) : "";

    if (!this.validateEmail(email)) throw badRequest("El email no tiene un formato válido");
    if (!data.name?.trim() || !data.surname?.trim()) throw badRequest("El nombre y el apellido son obligatorios");
    if (!data.password || String(data.password).length < 6)
      throw badRequest("La contraseña tiene que tener al menos 6 caracteres");
    if (!this.validateDocNumber(data.docNumber))
      throw badRequest("El número de documento debe contener solo dígitos");
    if (phoneNumber && !this.validatePhoneNumber(phoneNumber))
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15, por ejemplo 3411234567");

    if (!(await this.isEmailAvailable(email))) throw conflict("Ya hay una cuenta registrada con ese email");

    const token = jwt.sign(
      {
        purpose: "signup",
        email,
        name: data.name.trim(),
        surname: data.surname.trim(),
        docType: data.docType || "DNI",
        docNumber: data.docNumber || "",
        phoneNumber,
        password: await bcrypt.hash(String(data.password), 10),
      },
      process.env.CHANGE_SECRET as jwt.Secret,
      { expiresIn: "30m" }
    );

    const url = `${process.env.BASE_URL}/confirmar-cuenta?token=${token}`;

    const htmlContent = [
      title("Confirmá tu dirección"),
      paragraph(
        "Alguien pidió una cuenta en Consultorios del Jardín con este mail. Tocá el botón y la cuenta queda creada."
      ),
      button("Crear mi cuenta", url),
      note(
        `¿No funciona el botón? Copiá esta dirección en el navegador.<br><a href="${url}" style="color:#2f5e46;word-break:break-all">${url}</a>`
      ),
      note("El link vence en 30 minutos. Si no fuiste vos, ignorá este mensaje. Sin este paso la cuenta no se crea."),
    ].join("");

    const msg = await this.mailService.createMessage(email, "Confirmá tu dirección", htmlContent);
    await this.mailService.sendMail(msg);
  }

  /**
   * Crea la cuenta a partir del link del mail.
   *
   * Los datos salen del token y no del cuerpo del pedido: si vinieran de afuera, el link
   * validaría una dirección y daría de alta cualquier otra cosa. Lo único que se recibe es
   * el token, y todo lo demás es lo que se firmó cuando se mandó el mail.
   */
  async confirmSignup(token: string) {
    let data: any;

    try {
      data = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret) as any;
    } catch {
      throw new Error("Token expirado");
    }

    if (data?.purpose !== "signup") throw new Error("Token expirado");

    // La contraseña ya viene hasheada de cuando se firmó el token.
    return this.createPerson(
      {
        email: data.email,
        name: data.name,
        surname: data.surname,
        docType: data.docType,
        docNumber: data.docNumber,
        phoneNumber: data.phoneNumber,
        password: data.password,
        type: "client",
        active: true,
      } as any,
      true
    );
  }

  /**
   * El mail para elegir una contraseña nueva.
   *
   * Es el mismo en los dos casos, cambia quién lo pide. El de "¿Olvidaste tu contraseña?"
   * lo pidió la persona y dura media hora. El que manda la administración llega sin que
   * nadie lo haya pedido, así que lo dice, y dura meses (ver ADMIN_RESET_DAYS).
   *
   * Devuelve si el mail salió.
   */
  async sendPasswordMail(email: string, options: { byAdmin?: boolean } = {}): Promise<boolean> {
    const byAdmin = !!options.byAdmin;
    const changeToken = jwt.sign({ email }, process.env.CHANGE_SECRET as jwt.Secret, {
      expiresIn: byAdmin ? `${ADMIN_RESET_DAYS}d` : "30m",
    });
    const url = `${process.env.BASE_URL}/reset-password?token=${changeToken}`;

    // Un botón y, abajo, el link en texto: hay clientes de correo que no muestran el
    // botón, y pegar la dirección a mano tiene que seguir siendo posible.
    const htmlContent = [
      title("Cambiá tu contraseña"),
      paragraph(
        byAdmin
          ? "La administración de Consultorios del Jardín te pide que cambies tu contraseña. Tocá el botón y elegí una nueva."
          : "Pediste una contraseña nueva para tu cuenta. Tocá el botón y elegí una."
      ),
      button("Elegir contraseña nueva", url),
      note(
        `¿No funciona el botón? Copiá esta dirección en el navegador.<br><a href="${url}" style="color:#2f5e46;word-break:break-all">${url}</a>`
      ),
      note(
        byAdmin
          ? "Este mail lo envió la administración. El link vale por seis meses y sirve una sola vez. Si tenés dudas, escribile a la administración."
          : "El link vence en 30 minutos y sirve una sola vez. Si no pediste cambiarla, ignorá este mensaje. Tu contraseña sigue siendo la de siempre."
      ),
    ].join("");

    const msg = await this.mailService.createMessage(email, "Cambiá tu contraseña", htmlContent);
    return this.mailService.sendMail(msg);
  }

  /* ============================================================
     Primer ingreso del profesional
     ============================================================ */

  /**
   * El mail que le abre la cuenta al profesional.
   *
   * La cuenta se la crea el administrador, así que la contraseña no la eligió nadie: el
   * alta deja puesto el documento y este mail lleva el link para que ponga la suya. Antes
   * el administrador inventaba una, se la pasaba por fuera del sistema y el profesional
   * tenía que acordarse de ir a cambiarla.
   *
   * El link vale una sola vez y se apaga en cuanto se usa: ver setFirstPassword.
   *
   * Devuelve si el mail salió.
   */
  async sendFirstPasswordMail(person: Person): Promise<boolean> {
    const base = process.env.BASE_URL ?? "";
    const changeToken = jwt.sign({ email: person.email, purpose: "welcome" }, process.env.CHANGE_SECRET as jwt.Secret, {
      expiresIn: `${WELCOME_LINK_DAYS}d`,
    });
    const url = `${base}/bienvenida?token=${changeToken}`;
    const name = person.name ? `, ${escapeHtml(person.name)}` : "";

    // Un botón y, abajo, el link en texto: hay clientes de correo que no muestran el
    // botón, y pegar la dirección a mano tiene que seguir siendo posible.
    const htmlContent = [
      title(`Bienvenido/a${name}`),
      paragraph(
        "Ya tenés tu cuenta de profesional en Consultorios del Jardín. Para empezar a usarla, elegí tu contraseña."
      ),
      button("Crear mi contraseña", url),
      note(
        `¿No funciona el botón? Copiá esta dirección en el navegador.<br><a href="${url}" style="color:#2f5e46;word-break:break-all">${url}</a>`
      ),
      note(
        `El link vale por seis meses y sirve una sola vez. Cuando elijas tu contraseña deja de funcionar. ` +
          `Si se te pasa, entrá a <a href="${base}/forgot-password" style="color:#2f5e46">¿Olvidaste tu contraseña?</a> ` +
          "y pedí una nueva con este mismo email."
      ),
    ].join("");

    const message = await this.mailService.createMessage(
      person.email,
      "Creá tu contraseña de Consultorios del Jardín",
      htmlContent
    );
    return this.mailService.sendMail(message);
  }

  /**
   * Los profesionales habilitados, con su último cambio de contraseña.
   *
   * Es lo que mira la administración para saber quién sigue con la contraseña provisoria.
   * El cambio queda anotado desde que existe `passwordSetAt`: uno hecho antes no dejó
   * rastro y figura como sin cambio.
   */
  async professionalPasswords() {
    const people = await em.find(
      Person,
      { type: "professional", anonymous: false, active: true },
      { orderBy: { surname: "ASC", name: "ASC" } }
    );

    return people.map((person) => ({
      email: person.email,
      name: person.name,
      surname: person.surname,
      speciality: person.speciality ?? null,
      passwordChangedAt: person.passwordSetAt ?? null,
    }));
  }

  /**
   * Les manda a los profesionales elegidos el mail para cambiar la contraseña, dicho como
   * enviado por la administración.
   *
   * Solo a habilitados. Los mails van de a uno, para no pedirle al proveedor de golpe más
   * de lo que acepta.
   */
  async sendAdminPasswordMails(emails: unknown) {
    const wanted = Array.isArray(emails) ? [...new Set(emails.map((email) => String(email).toLowerCase()))] : [];
    if (wanted.length === 0) throw badRequest("Falta elegir a quién mandarle el mail");

    const people = await em.find(Person, {
      email: { $in: wanted },
      type: "professional",
      anonymous: false,
      active: true,
    });

    const sent: string[] = [];
    const failed: string[] = [];

    for (const person of people) {
      const ok = await this.sendPasswordMail(person.email, { byAdmin: true }).catch((error) => {
        console.error("No se pudo mandar el mail de contraseña a", person.email, error);
        return false;
      });
      (ok ? sent : failed).push(person.email);
    }

    return { sent, failed, skipped: wanted.length - people.length };
  }

  /**
   * Lee el link de bienvenida. Lo que no es un link de bienvenida vivo es "Token expirado".
   *
   * El corte por `purpose` va en los dos sentidos. Los tres circuitos firman con la misma
   * clave, así que sin mirar para qué se firmó, el link de recuperar contraseña serviría
   * para el primer ingreso y al revés.
   */
  private readWelcomeToken(token: string): string {
    try {
      // El vencimiento se mide acá, desde que se firmó, y no con el que lleva adentro: los
      // primeros links salieron firmados por siete días, y así esos también duran lo mismo
      // que los nuevos.
      const data = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret, { ignoreExpiration: true }) as any;
      if (data?.purpose !== "welcome") throw new Error("Token expirado");

      const age = Date.now() - Number(data.iat) * 1000;
      if (!Number.isFinite(age) || age > WELCOME_LINK_DAYS * 24 * 60 * 60 * 1000) throw new Error("Token expirado");

      return String(data.email);
    } catch {
      throw new Error("Token expirado");
    }
  }

  /**
   * ¿El link sirve? Se pregunta antes de mostrar el formulario, para saludar por el nombre
   * y para no hacer elegir una contraseña que después no se va a poder guardar.
   */
  async checkWelcomeLink(token: string) {
    const email = this.readWelcomeToken(token);
    const person = await em.findOne(Person, { email });

    if (!person) throw new Error("Token expirado");
    if (!person.active) throw new Error("USER_DISABLED");
    if (person.anonymous) throw new Error("ANONYMOUS_ACCOUNT");
    if (person.passwordSetAt) throw new Error("LINK_USED");

    return { name: person.name };
  }

  /**
   * La contraseña que elige el profesional la primera vez.
   *
   * Guardarla apaga el link: `passwordSetAt` es lo único que lo distingue de un link
   * recién mandado, porque lo que viaja firmado no cambia. Por eso también es lo que hace
   * que este circuito no se pueda repetir para entrar a una cuenta ya en uso.
   */
  async setFirstPassword(token: string, password: string) {
    if (!password || String(password).length < MIN_PASSWORD)
      throw badRequest(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres`);

    const email = this.readWelcomeToken(token);
    const person = await em.findOne(Person, { email });

    if (!person) throw new Error("Token expirado");
    if (!person.active) throw new Error("USER_DISABLED");
    if (person.anonymous) throw new Error("ANONYMOUS_ACCOUNT");
    if (person.passwordSetAt) throw new Error("LINK_USED");

    person.password = await bcrypt.hash(String(password), 10);
    person.passwordSetAt = new Date();
    await em.flush();

    // La bienvenida con lo que puede hacer va recién ahora. Antes salía al crear la cuenta,
    // cuando todavía no podía entrar a ver nada de lo que le prometía.
    await this.sendWelcomeEmail(person);
    return person;
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
   *
   * Del lado de cerrar hay dos puertas que no se pueden cruzar, y las dos son la misma
   * idea: deshabilitar es fácil de deshacer *desde afuera*, y nada más. Quien queda del
   * otro lado no puede pedir nada, ni siquiera que lo vuelvan a abrir.
   *
   * Cerrar a un profesional lo saca además de la búsqueda de turnos, y eso no se deshace
   * solo. Las dos cosas se pueden mirar como lo mismo —una cuenta cerrada tampoco
   * aparece— pero no lo son: el día que se la vuelve a abrir, `bookable` es lo que decide
   * si el profesional vuelve a ofrecerse a los pacientes o si primero hay que acomodarle
   * los horarios. Prenderlo solo significaba que reabrir una cuenta ponía a alguien en la
   * agenda del público sin que nadie lo hubiera decidido.
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

    if (!active) {
      // Nadie se cierra a sí mismo. Es un clic sin vuelta atrás: la cuenta queda afuera y
      // desde afuera no se puede pedir volver, así que hace falta que lo haga otro.
      if (actorEmail && actorEmail.toLowerCase() === email.toLowerCase()) {
        throw forbidden("No podés deshabilitar tu propia cuenta. Tiene que hacerlo otro administrador");
      }

      // Y no puede quedar el sistema sin ninguno. Es la misma razón por la que la regla
      // de intrusión no cierra al último administrador activo (ver lockForCompromise):
      // sin nadie que pueda habilitar, no hay forma de volver desde la aplicación.
      if (person.type === "admin" && (await em.count(Person, { type: "admin", active: true })) <= 1) {
        throw forbidden(
          "Es el único administrador activo. Si se deshabilita no queda nadie que pueda volver a habilitar cuentas, " +
            "ni siquiera la suya"
        );
      }
    }

    em.assign(person, {
      ...person,
      active,
      // Ver arriba: al cerrar se apaga, al reabrir queda como estaba.
      bookable: !active && person.type === "professional" ? false : person.bookable,
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

    // Cuándo se borra, para que la pantalla lo diga sin tener que volver a preguntar.
    return {
      active: person.active,
      bookable: person.bookable,
      deletionAt: person.active ? null : deletionDateFor(person.bannedAt ?? new Date()),
    };
  }
}
