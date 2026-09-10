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
   */
  async createPerson(data: RequiredEntityData<Person>, hashed = false) {
    if (data.phoneNumber)
      data.phoneNumber = this.normalizePhoneNumber(data.phoneNumber);

    this.validateCommonFields(data as Partial<Person>);

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
      throw badRequest("El número de teléfono tiene que tener 10 dígitos, sin 0 ni 15, por ejemplo 3411234567");

    const existing = await em.findOne(Person, { email: data.email });
    if (existing)
      throw conflict(
        existing.anonymous
          ? "Ya cargaste un paciente con ese email"
          : "Ese email ya pertenece a una cuenta registrada. Buscá a la persona en la lista en vez de cargarla de nuevo"
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
      waitlistEnabled: true,
      autoAccept: false,
      autoMarkWhen: "appointment" as const,
      autoPay: false,
      autoPayWhen: "appointment" as const,
      anonymous: true,
      createdBy: data.createdBy,
    });

    await em.flush();
    return person;
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
            { title: "Pacientes", text: "Con cuenta y anónimos, con su historial y tus observaciones." },
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

    try {
      const decodedToken = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret) as any;
      // Los dos circuitos firman con la misma clave, así que lo que los separa es este
      // campo. Sin el corte, el link de "validá tu mail" —que lleva adentro los datos de
      // una cuenta que todavía no existe— serviría para cambiarle la contraseña a alguien.
      if (decodedToken.purpose) throw new Error("Token expirado");
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
  async deleteAnonymousPatient(email: string, professionalEmail: string) {
    const person = await em.findOne(Person, { email });
    if (!person) throw notFound("No encontramos a esa persona");

    if (!person.anonymous || person.type !== "client")
      throw forbidden("Solo se puede borrar un paciente sin cuenta");
    if (person.createdBy !== professionalEmail) throw forbidden("Ese paciente lo cargó otro profesional");

    // Cuenta los turnos de cualquier estado, cancelados incluidos. Un turno cancelado
    // sigue siendo algo que pasó entre esas dos personas.
    const turnos = await em.count(Appointment, { patient: { email } });
    if (turnos > 0) throw conflict("Ese paciente ya tiene turnos, así que no se puede borrar");

    await em.removeAndFlush(person);
    return true;
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

  async sendPasswordMail(email: string) {
    const changeToken = jwt.sign({ email }, process.env.CHANGE_SECRET as jwt.Secret, { expiresIn: "30m" });
    const url = `${process.env.BASE_URL}/reset-password?token=${changeToken}`;

    // Un botón y, abajo, el link en texto: hay clientes de correo que no muestran el
    // botón, y pegar la dirección a mano tiene que seguir siendo posible.
    const htmlContent = [
      title("Cambiá tu contraseña"),
      paragraph("Pediste una contraseña nueva para tu cuenta. Tocá el botón y elegí una."),
      button("Elegir contraseña nueva", url),
      note(
        `¿No funciona el botón? Copiá esta dirección en el navegador.<br><a href="${url}" style="color:#2f5e46;word-break:break-all">${url}</a>`
      ),
      note(
        "El link vence en 30 minutos y sirve una sola vez. Si no pediste cambiarla, ignorá este mensaje. Tu contraseña sigue siendo la de siempre."
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

    return { active: person.active, bookable: person.bookable };
  }
}
