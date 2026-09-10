import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PeopleService } from "./people.service.js";
import { WaitlistService } from "../waitlist/waitlist.service.js";
import { sendError } from "../shared/errors.js";
import { clientChannel } from "../config/clients.js";
import { describeLockout } from "../config/middlewares.js";

dotenv.config();

interface RequestWithUser extends Request {
  user?: any;
}

function sanitizePersonInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    email: req.body.email,
    docType: req.body.docType,
    docNumber: req.body.docNumber,
    name: req.body.name,
    surname: req.body.surname,
    phoneNumber: req.body.phoneNumber,
    password: req.body.password,
    speciality: req.body.speciality,
    about: req.body.about,
    type: req.body.type,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  };

  //more checks here

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

const peopleService = new PeopleService();

// Las opciones de la cookie httpOnly del refresh token. Las mismas se usan para setearla
// y para borrarla; si no coinciden, el browser no la borra en el logout.
//
// Las opciones cambian según dónde corra, porque el navegador aplica reglas distintas.
//
// Desplegado, el front vive en un dominio y el backend en otro, así que la cookie es
// cross-site: el navegador solo la manda con sameSite "none", y solo acepta "none" si
// además es secure. Sin las dos, el refresh token nunca llega y la sesión se corta a los
// quince minutos, cuando vence el token de acceso.
//
// En local el front pega a /api por el proxy de Vite, así que las requests son
// same-origin y alcanza con "lax". "none" no serviría: sobre http sin secure, los
// navegadores la descartan.
const REFRESH_COOKIE_OPTIONS =
  process.env.NODE_ENV === "production"
    ? ({ httpOnly: true, secure: true, sameSite: "none" } as const)
    : ({ httpOnly: true, secure: false, sameSite: "lax" } as const);

/**
 * Entrega el refresh token por las dos vías a la vez, y deja que el navegador elija.
 *
 * La cookie httpOnly es la buena: el JS de la página no la puede leer, así que un XSS no
 * se lleva la sesión. Se dejó de usar al desplegar, porque la web y el backend quedaron
 * en dominios distintos y ahí pasó a ser una cookie de terceros, de las que Safari y
 * Firefox bloquean. En un iPhone la sesión se cortaba a los quince minutos.
 *
 * El problema de decidirlo desde acá es que el servidor no sabe qué navegador hay del
 * otro lado ni qué tiene configurado. Así que no decide: manda las dos y el cliente
 * averigua cuál le funcionó. La web prueba renovar la sesión con la cookie sola; si sale,
 * borra la copia que había guardado y no la guarda nunca más en ese navegador. Ver
 * cookieSirveSola en axios.ts.
 *
 * A la app no se le manda la cookie: no tiene dónde guardarla y ya usa el llavero del
 * sistema, que es su equivalente del httpOnly.
 */
function deliverRefreshToken(req: Request, res: Response, refreshToken: string): Record<string, string> {
  if (clientChannel(req) !== "app") res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  return { refreshToken };
}

async function findAll(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPeople();
    const safeData = people.map((person) => ({ ...person, password: undefined })); // no devolvemos la contraseña al front
    res.status(200).json({ message: "Personas encontradas", data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllPerType(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPerType(req.params.peopleType);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas encontradas del tipo ${req.params.peopleType}`, data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllPerTypeActive(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPerTypeActive(req.params.peopleType);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas activas encontradas del tipo ${req.params.peopleType}`, data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllNoAdmin(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllNoAdmin();
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas no administrador encontradas`, data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findProfesionalByOffice(req: Request, res: Response) {
  try {
    const officeId = Number.parseInt(req.params.officeId);
    const people = await peopleService.findProfesionalByOffice(officeId, req.params.speciality);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: "Personas profesionales encontradas en el consultorio", data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

/**
 * Lo que se ve de una persona cuando quien pregunta no es ni ella misma ni del
 * consultorio. Es lo que la pantalla de pedir turno necesita para mostrar al
 * profesional, y nada más.
 */
const PUBLIC_FIELDS = ["email", "name", "surname", "speciality", "about", "type", "active", "bookable"] as const;

/**
 * Ficha de una persona.
 *
 * La ficha entera es para quien pregunta por sí mismo y para el consultorio: el
 * profesional necesita el teléfono y el documento de su paciente, y el admin ve todo.
 * Un paciente preguntando por otra persona recibe solo la parte pública.
 *
 * Antes recibía la ficha completa. Con estar en el sistema y saberse un mail alcanzaba
 * para leer el documento y el teléfono de cualquiera, pacientes y profesionales incluidos.
 */
async function findOne(req: RequestWithUser, res: Response) {
  try {
    const person = await peopleService.findPersonByEmail(req.params.email);

    const asking = req.user;
    const itsMe = asking?.email === person.email;
    const fromTheOffice = asking?.type === "admin" || asking?.type === "professional";

    const safeData =
      itsMe || fromTheOffice
        ? { ...person, password: undefined } // no devolvemos la contraseña al front
        : Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, person[field]]));

    res.status(200).json({ message: "Persona encontrada", data: safeData });
  } catch (error: any) {
    sendError(res, error);
  }
}

// Consulta pública que usa el registro para avisar en el primer paso, en vez de
// dejar que el usuario complete todo y choque contra un 409 al final.
async function checkEmailAvailability(req: Request, res: Response) {
  try {
    const available = await peopleService.isEmailAvailable(req.params.email);
    res.status(200).json({ available });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function add(req: Request, res: Response) {
  try {
    if (!["client", "professional"].includes(req.body.sanitizedInput.type))
      return res.status(403).json({ message: "El tipo de cuenta no es válido" });

    // El paciente ya no se da de alta por acá: primero tiene que validar su dirección.
    // El profesional sí, que es un pedido que después aprueba el administrador.
    if (req.body.sanitizedInput.type === "client")
      return res.status(403).json({
        message: "Ahora la cuenta se crea desde el link que te llega por mail. Pedilo de nuevo desde la pantalla de registro.",
        code: "SIGNUP_NEEDS_EMAIL",
      });

    const person = await peopleService.createPerson(req.body.sanitizedInput);
    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    // Para el panel de números: quién entra por la app y quién por la página. No se
    // espera, y si falla no se entera nadie: no es parte de iniciar sesión.
    const channel = clientChannel(req);
    if (channel) void peopleService.recordAccess(person.email, channel);

    const session = deliverRefreshToken(req, res, refreshToken);

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front

    res.status(201).json({ message: "Persona creada con éxito!", data: safeData, token, ...session }); // return person data and token
  } catch (error: any) {
    sendError(res, error, { duplicate: "Ya hay una cuenta registrada con ese email" });
  }
}

async function update(req: RequestWithUser, res: Response) {
  try {
    const target = await peopleService.findPersonOrNull(req.params.email);
    if (!target) return res.status(404).json({ message: "No encontramos a esa persona" });

    const isSelf = req.user.email === target.email;
    const isAdmin = req.user.type === "admin";
    // Un paciente anónimo no tiene cuenta: no puede mantener sus propios datos al día.
    // Por eso el profesional que lo cargó puede corregirlos. Ojo que la condición incluye
    // `anonymous`: en cuanto la persona se registra, la cuenta pasa a ser suya y nadie
    // más la edita.
    const ownsAnonymousPatient =
      req.user.type === "professional" && target.anonymous && target.createdBy === req.user.email;

    if (!isAdmin && !isSelf && !ownsAnonymousPatient)
      return res.status(403).json({ message: "No podés modificar los datos de otra persona" });

    const changes = { ...req.body.sanitizedInput };

    // El email es la PK y no se cambia. La contraseña tiene su propio endpoint, que la
    // hashea. Ojo: antes esto era un solo `delete a, b`, y el operador coma hacía que solo
    // se borrara el email; la contraseña seguía pasando (y se guardaba sin hashear).
    delete changes.email;
    delete changes.password;
    // El tipo se define en el alta y el baneo tiene su endpoint (toggleState). Además
    // sanitizePersonInput mete `active: true` por defecto, así que sin este delete
    // cualquier edición de datos reactivaba a un usuario deshabilitado.
    delete changes.type;
    delete changes.active;

    const person = await peopleService.updatePerson(changes, req.params.email);

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front
    res.status(200).json({ message: "Persona actualizada con éxito!", data: safeData });
  } catch (error: any) {
    sendError(res, error, { duplicate: "Ya existe una persona con esos datos", missing: "No encontramos a esa persona" });
  }
}

// Alta de un profesional hecha por el admin. A diferencia del registro público, no
// emite tokens ni toca la cookie de sesión: el que está logueado sigue siendo el admin.
async function addProfessional(req: RequestWithUser, res: Response) {
  try {
    const person = await peopleService.createPerson({ ...req.body.sanitizedInput, type: "professional" });
    const safeData = { ...person, password: undefined };
    res.status(201).json({ message: "Profesional registrado con éxito!", data: safeData });
  } catch (error: any) {
    sendError(res, error, { duplicate: "Ya hay una cuenta registrada con ese email" });
  }
}

// Alta de un paciente anónimo (dummy). Solo un profesional puede cargarlo:
// sirve para anotar a alguien que todavía no tiene cuenta.
async function addAnonymousPatient(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const { email, name, surname, docType, docNumber, phoneNumber } = req.body.sanitizedInput;
    const person = await peopleService.createAnonymousPatient({
      email,
      name,
      surname,
      docType,
      docNumber,
      phoneNumber,
      createdBy: req.user.email,
    });

    const safeData = { ...person, password: undefined };
    res.status(201).json({ message: "Paciente creado con éxito!", data: safeData });
  } catch (error: any) {
    sendError(res, error, { duplicate: "Ya existe una persona con ese email" });
  }
}

// Deshacer el alta de un paciente sin cuenta. No es la baja de una persona: el servicio
// solo lo deja pasar si lo cargó este mismo profesional y todavía no tiene ningún turno.
async function removeAnonymousPatient(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    await peopleService.deleteAnonymousPatient(req.params.email, req.user.email);
    res.status(200).json({ message: "Paciente borrado" });
  } catch (error: any) {
    sendError(res, error, { missing: "No encontramos a esa persona" });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const valid = await peopleService.deletePersonRequest(req.params.email);

    if (valid) {
      return res.status(200).json({ message: "Solicitud rechazada" });
    }
    return res.status(401).json({ message: "La persona no puede ser removida" });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function loginWithEmailAndPassword(req: Request, res: Response) {
  try {
    const { email, password } = req.body.sanitizedInput;

    const person = await peopleService.findPersonOrNull(email);

    if (!person) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Un paciente anónimo no tiene contraseña: no puede iniciar sesión.
    if (person.anonymous || !person.password) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isValid = await bcrypt.compare(password, person.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Se contesta después de validar la contraseña y no antes: así el mensaje de una
    // cuenta cerrada solo lo ve quien sabe la contraseña, y no cualquiera que pruebe
    // emails para averiguar cuáles existen.
    if (!person.active) {
      return res.status(403).json(describeLockout(person));
    }

    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    // Para el panel de números: quién entra por la app y quién por la página. No se
    // espera, y si falla no se entera nadie: no es parte de iniciar sesión.
    const channel = clientChannel(req);
    if (channel) void peopleService.recordAccess(person.email, channel);

    const session = deliverRefreshToken(req, res, refreshToken);

    res.status(200).json({ message: "Login exitoso", token, ...session });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function logOut(req: Request, res: Response) {
  // Las opciones tienen que ser las mismas con las que se seteó la cookie,
  // si no el browser no la borra.
  res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

  // El logout es del lado del cliente: el refresh token sigue siendo válido hasta que expire.
  res.status(200).json({ message: "Sesión cerrada" });
}

async function toggleState(req: RequestWithUser, res: Response) {
  try {
    const state = await peopleService.toggleState(req.params.email, req.user?.email);
    res.status(200).json({ message: "Estado de la persona cambiado con éxito", data: state });
  } catch (error: any) {
    // Un rechazo de seguridad tiene que llegar con su motivo: "algo salió mal" deja al
    // administrador sin saber que lo que falta es que la revise otra persona.
    sendError(res, error, { fallback: "Ups! Algo salió mal. Intente más tarde" });
  }
}

/** Mostrar o esconder a un profesional de la búsqueda de turnos. No lo deshabilita. */
async function toggleBookable(req: Request, res: Response) {
  try {
    const person = await peopleService.toggleBookable(req.params.email);
    res.status(200).json({
      message: person.bookable
        ? "El profesional vuelve a aparecer cuando se busca turno"
        : "El profesional deja de aparecer cuando se busca turno",
      data: { bookable: person.bookable },
    });
  } catch (error: any) {
    sendError(res, error, { missing: "Ese profesional no existe" });
  }
}

/**
 * Prender o apagar la lista de espera de un profesional.
 *
 * Apagarla la vacía en el momento y les avisa a los que estaban: una lista apagada que
 * sigue teniendo gente adentro es gente esperando algo que no va a llegar.
 */
async function toggleWaitlist(req: Request, res: Response) {
  try {
    const person = await peopleService.toggleWaitlist(req.params.email);
    const closed = person.waitlistEnabled ? 0 : await new WaitlistService().closeForProfessional(person.email);

    res.status(200).json({
      message: person.waitlistEnabled
        ? "El profesional vuelve a trabajar con lista de espera"
        : closed > 0
          ? `Se apagó la lista de espera. Les avisamos a las ${closed} personas que estaban`
          : "Se apagó la lista de espera",
      data: { waitlistEnabled: person.waitlistEnabled },
    });
  } catch (error: any) {
    sendError(res, error, { missing: "Ese profesional no existe" });
  }
}

async function changePassword(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Acceso denegado" });
    await peopleService.changePassword(token, req.body.sanitizedInput.password);
    res.status(200).json({ message: "Contraseña cambiada con exita" });
  } catch (error: any) {
    if (error.message === "USER_DISABLED") return res.status(403).json({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    if (error.message === "ANONYMOUS_ACCOUNT") return res.status(403).json({ message: "Esta persona no tiene cuenta", code: "ANONYMOUS_ACCOUNT" });
    // El link vencido es el final más común de este circuito: decirlo con todas las
    // letras evita que alguien reintente cinco veces creyendo que falla la contraseña.
    if (error.message === "Token expirado")
      return res
        .status(401)
        .json({ message: "El link venció o ya se usó. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\"", code: "RESET_TOKEN_INVALID" });
    res.status(500).json({ message: "Ups! Algo salió mal. Intente más tarde" });
  }
}

/**
 * Primer paso del alta de un paciente: el mail con el link.
 *
 * Contesta lo mismo haya o no una cuenta con esa dirección, igual que el de recuperar la
 * contraseña. Contestar distinto convertiría esta ruta en una forma cómoda de averiguar
 * qué direcciones están registradas, y acá encima ni siquiera hace falta estar adentro.
 */
async function requestSignup(req: Request, res: Response) {
  const sent = { message: "Te mandamos un mail con el link para terminar de crear la cuenta" };

  try {
    await peopleService.sendSignupMail(req.body.sanitizedInput);
    return res.status(200).json(sent);
  } catch (error: any) {
    // El email ya tomado se calla; lo que está mal escrito se dice, porque es lo que la
    // persona tiene que corregir para poder seguir.
    if (error?.status === 409) return res.status(200).json(sent);
    if (error?.status === 400) return sendError(res, error);

    console.error("Error mandando el mail de alta:", error);
    return res.status(500).json({ message: "No pudimos mandar el mail. Probá de nuevo en un rato" });
  }
}

/**
 * Segundo paso: el link del mail crea la cuenta y deja la sesión abierta.
 *
 * Devuelve lo mismo que devolvía el alta directa, así que quien confirma entra sin tener
 * que escribir la contraseña que acaba de elegir.
 */
async function confirmSignup(req: Request, res: Response) {
  try {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ message: "Al link le falta la parte que identifica tu pedido" });

    const person = await peopleService.confirmSignup(String(token));
    const { token: access, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    const channel = clientChannel(req);
    if (channel) void peopleService.recordAccess(person.email, channel);

    const session = deliverRefreshToken(req, res, refreshToken);
    const safeData = { ...person, password: undefined };

    return res.status(201).json({ message: "Cuenta creada con éxito!", data: safeData, token: access, ...session });
  } catch (error: any) {
    if (error.message === "Token expirado")
      return res.status(401).json({
        message: "El link venció. Volvé a la pantalla de registro y pedilo de nuevo",
        code: "SIGNUP_TOKEN_INVALID",
      });

    return sendError(res, error, { duplicate: "Ya hay una cuenta registrada con ese email" });
  }
}

/**
 * Pedido del mail para recuperar la contraseña.
 *
 * Si el email no tiene cuenta se responde igual que si la tuviera: contestar distinto
 * convierte a esta ruta en una forma cómoda de averiguar qué direcciones están
 * registradas. Antes tiraba un 500, que además de filtrar el dato quedaba en pantalla
 * como si se hubiera roto algo.
 */
async function sendPasswordMail(req: RequestWithUser, res: Response) {
  const sent = { message: "Si hay una cuenta con ese email, te mandamos el link" };

  try {
    const person = await peopleService.findPersonByEmail(req.params.email);
    if (!person.active) return res.status(403).json({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    if (person.anonymous) return res.status(403).json({ message: "Esta persona no tiene cuenta", code: "ANONYMOUS_ACCOUNT" });

    await peopleService.sendPasswordMail(person.email);
    return res.status(200).json(sent);
  } catch (error: any) {
    if (error?.name === "NotFoundError") return res.status(200).json(sent);

    console.error("Error mandando el mail de recuperación:", error);
    return res.status(500).json({ message: "No pudimos mandar el mail. Probá de nuevo en un rato" });
  }
}
export {
  sanitizePersonInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  loginWithEmailAndPassword,
  logOut,
  toggleState,
  toggleBookable,
  toggleWaitlist,
  changePassword,
  sendPasswordMail,
  requestSignup,
  confirmSignup,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive,
  addAnonymousPatient,
  removeAnonymousPatient,
  addProfessional,
  checkEmailAvailability,
};
