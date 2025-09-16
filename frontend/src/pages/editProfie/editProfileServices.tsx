import api from "../../axios";
import type { Person } from "../types";

type PersonUpdate = Partial<Pick<Person, "name" | "surname" | "phoneNumber" | "docType" | "docNumber">> & { email: string };

export function updatePerson(person: PersonUpdate): Promise<Person | undefined> {
  return api.put(`/people/${person.email}`, person)
    .then(res => res.data.data as Person)
    .catch(err => {
      throw err; 
    });
}