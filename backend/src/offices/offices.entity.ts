import crypto from 'node:crypto' //Lo vamos a necesitar?

export class Office {
  constructor(
    public idOffice: string, //Hardcodeado por el momento
    public description: string,
    public idCity: string,
    public closingTime: string,
    public openingTime: string,

    )  {}
}