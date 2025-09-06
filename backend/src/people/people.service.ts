import { orm } from "../shared/db/orm.js";
import { Person } from "./people.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const em = orm.em;

export class PeopleService {
  async findAllPeople(): Promise<Person[]> {
    return await em.find(Person, {});
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
      expiresIn: "7d",
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

  async deletePersonRequest(email: string){ //El metodo permite eliminar un profesional siempre y cuando no este activo, es decir, sea una request. Si ya trabajo previamente, la bd tirara error y no lo permitira
    const person = await em.findOneOrFail(Person, {email});

    if(!person.active && person.type == "professional"){
        await em.removeAndFlush(person)
        return true
    }

    return false
  }
}
