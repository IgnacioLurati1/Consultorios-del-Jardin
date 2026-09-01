import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PeopleService } from "./people.service.js";
import { sendError } from "../shared/errors.js";

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

// El refresh token vive solo en esta cookie httpOnly: el JS de la página no puede leerlo.
// Las mismas opciones se usan para setearla y para borrarla; si no coinciden, el browser
// no la borra en el logout.
//
// Dev local sobre http://localhost: el front pega a /api a través del proxy de Vite, así que
// las requests son same-origin y alcanza con "lax". La combinación secure + sameSite "none"
// es para un front en otro dominio por HTTPS, y sobre http local no funciona parejo entre
// browsers. Si algún día hay deploy con dominios separados, vuelve a ser
// { secure: true, sameSite: "none" }.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
} as const;

async function findAll(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPeople();
    const safeData = people.map((person) => ({ ...person, password: undefined })); // no devolvemos la contraseña al front
    res.status(200).json({ message: "Personas encontradas", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findAllPerType(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPerType(req.params.peopleType);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas encontradas del tipo ${req.params.peopleType}`, data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findAllPerTypeActive(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPerTypeActive(req.params.peopleType);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas activas encontradas del tipo ${req.params.peopleType}`, data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findAllNoAdmin(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllNoAdmin();
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas no administrador encontradas`, data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findProfesionalByOffice(req: Request, res: Response) {
  try {
    const officeId = Number.parseInt(req.params.officeId);
    const people = await peopleService.findProfesionalByOffice(officeId, req.params.speciality);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: "Personas profesionales encontradas en el consultorio", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const person = await peopleService.findPersonByEmail(req.params.email);
    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front
    res.status(200).json({ message: "Persona encontrada", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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

    const person = await peopleService.createPerson(req.body.sanitizedInput);
    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front

    res.status(201).json({ message: "Persona creada con éxito!", data: safeData, token }); // return person data and token
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

async function remove(req: Request, res: Response) {
  try {
    const valid = await peopleService.deletePersonRequest(req.params.email);

    if (valid) {
      return res.status(200).json({ message: "Solicitud rechazada" });
    }
    return res.status(401).json({ message: "La persona no puede ser removida" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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

    if (!person.active) {
      return res.status(403).json({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    }

    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({ message: "Login exitoso", token });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function logOut(req: Request, res: Response) {
  // Las opciones tienen que ser las mismas con las que se seteó la cookie,
  // si no el browser no la borra.
  res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

  // El logout es del lado del cliente: el refresh token sigue siendo válido hasta que expire.
  res.status(200).json({ message: "Sesión cerrada" });
}

async function toggleState(req: Request, res: Response) {
  try {
    await peopleService.toggleState(req.params.email);
    res.status(200).json({ message: "Estado de la persona cambiado con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: "Ups! Algo salió mal. Intente más tarde" });
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
  changePassword,
  sendPasswordMail,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive,
  addAnonymousPatient,
  addProfessional,
  checkEmailAvailability,
};
