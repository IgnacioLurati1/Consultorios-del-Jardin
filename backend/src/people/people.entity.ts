import crypto from 'node:crypto' // Importing crypto for generating unique, IDs reemplazado por BD luego

export class Person {
    constructor(
        public email: string,
        public docType: string,
        public docNumber: string,
        public name: string,
        public surname: string,
        public phoneNumber: string,
        public password: string,
    )  {}
}