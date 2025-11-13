import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PeopleService } from "./people.service.js";

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

async function finAllPerTypeActive(req: Request, res: Response) {
  try {
    const people = await peopleService.findAllPerTypeActive(req.params.peopleType);
    const safeData = people.map((person) => ({ ...person, password: undefined }));
    res.status(200).json({ message: `Personas activas encontradas del tipo ${req.params.peopleType}`, data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findAllNoAdmin(req: Request, res:Response){
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
    res.status(200).json({ message: "Personas profesionales encontradas en el consultorio" , data: safeData });
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

async function add(req: Request, res: Response) {
  try {
    if (!["client", "professional"].includes(req.body.sanitizedInput.type))
      return res.status(403).json({ message: "Credenciales inválidas" });

    const person = await peopleService.createPerson(req.body.sanitizedInput);
    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front

    res.status(201).json({ message: "Persona creada con éxito!", data: safeData, token }); // return person data and token
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: RequestWithUser, res: Response) {
  try {
    // if (!(req.user.email == req.params.email)) return res.status(401).json({ message: "Credenciales inválidas" });
    delete req.body.sanitizedInput.email, req.body.sanitizedInput.password; // no se permite cambiar emails ni contraseñas

    const person = await peopleService.updatePerson(req.body.sanitizedInput, req.params.email);

    if (!person) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front
    res.status(200).json({ message: "Persona actualizada con éxito!", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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

    const isValid = await bcrypt.compare(password, person.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.status(200).json({ message: "Login exitoso", token });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function logOut(req: Request, res: Response) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false, // cambiar en produccion
    sameSite: "lax", // no funciona al reves el proxy jeje
  });
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
    res.status(500).json({ message: "Ups! Algo salió mal. Intente más tarde" });
  }
}

async function sendPasswordMail(req: RequestWithUser, res: Response) {
  try {
    const person = await peopleService.findPersonByEmail(req.params.email); //Revisamos que exista
    await peopleService.sendPasswordMail(person.email);
    res.status(200).json({ Message: "Mail enviado!" });
  } catch (error: any) {
    res.status(500).json({ Message: "Ups! Algo salió mal" });
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
  finAllPerTypeActive,
};
