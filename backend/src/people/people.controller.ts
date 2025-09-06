import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PeopleService } from "./people.service.js";

const em = orm.em;
dotenv.config();

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
    type: req.body.type ? req.body.type : "client", // Por las dudas
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
    res.status(200).json({ message: "People found", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const person = await peopleService.findPersonByEmail(req.params.email);
    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front
    res.status(200).json({ message: "Person found", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const person = await peopleService.createPerson(req.body.sanitizedInput);

    const { token, refreshToken } = await peopleService.createPersonTokens(person.email, person.type);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front

    res.status(201).json({ message: "Person created", data: safeData, token }); // return person data and token
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const person = await peopleService.updatePerson(req.body.sanitizedInput, req.params.email);
    //Falta contastar el token

    if (!person) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const safeData = { ...person, password: undefined }; // no devolvemos la contraseña al front
    res.status(200).json({ message: "Person updated", data: safeData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const valid = await peopleService.deletePersonRequest(req.params.email);

    if (valid) {
      return res.status(200).json({ message: "Person removed" });
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
      secure: true,
      sameSite: "strict",
    });

    res.status(200).json({ message: "Login exitoso", token });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function logOut(req: Request, res: Response) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
}

export { sanitizePersonInput, findAll, findOne, add, update, remove, loginWithEmailAndPassword, logOut };
