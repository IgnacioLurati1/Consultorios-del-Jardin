import crypto from 'node:crypto'

export class Office {
  constructor(
    public idOffice: string,
    public description: string,
    public idCity: string,
    public closingTime: string,
    public openingTime: string,

    )  {}
}