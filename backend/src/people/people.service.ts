import { orm } from "../shared/db/orm.js";
import { Person } from "./people.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";

dotenv.config();

const em = orm.em;

export class PeopleService {
  async findAllPeople(): Promise<Person[]> {
    return await em.find(Person, {});
  }

  async findAllPerType(peopleType: string): Promise<Person[]> {
    return await em.find(Person, { type: peopleType });
  }

  async findPersonByEmail(email: string): Promise<Person> {
    return em.findOneOrFail(Person, { email });
  }

  async findPersonOrNull(email: string): Promise<Person | null> {
    return em.findOne(Person, { email });
  }

  async createPerson(data: RequiredEntityData<Person>) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const person = em.create(Person, { ...data, password: hashedPassword });
    await em.flush();
    return person;
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

  async updatePerson(data: Partial<Person>, email: string) {
    const person = await em.findOneOrFail(Person, { email });

    if (data.password) {
      let isValid = await bcrypt.compare(data.password, person.password);

      if (isValid) {
        let hashedPassword = await bcrypt.hash(data.password, 10);
        em.assign(person, { ...data, password: hashedPassword });
        await em.flush();
        return person;
      }
    }

    return null;
  }

  async changePassword(token: any, newPassword: string) {
    try {
      const decodedToken = jwt.verify(token, process.env.CHANGE_SECRET as jwt.Secret) as any;
      const email = decodedToken.email;
      const person = await em.findOneOrFail(Person, { email });
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      person.password = newPasswordHash;
      await em.flush();
    } catch (error: any) {
      throw new Error("Token expirado");
    }
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
    sgMail.setApiKey(process.env.SENDGRID_KEY as any);

    const changeToken = jwt.sign({ email }, process.env.CHANGE_SECRET as jwt.Secret, { expiresIn: "30m" });
    const url = `http://localhost:5173/reset-password?token=${changeToken}`;
    const fromMail = process.env.MAIL as string;

    const msg = {
      to: email,
      from: fromMail,
      replyTo: fromMail,
      subject: "Recuperar contraseña",
      html: `
          <h3>Hola!</h3>
          <p>Para restablecer tu contraseña hacé click en el siguiente enlace:</p>
          <a href="${url}">${url}</a>
          <p>Este link expira en 30 minutos.</p>`,
    };

    await sgMail.send(msg);
  }

  async toggleState(email: string) {
    const person = await em.findOneOrFail(Person, { email });
    if (person.type != "professional") throw new Error("Usuario no es profesional");
    em.assign(person, { ...person, active: true });
    await em.flush();
    return true;
  }
}
