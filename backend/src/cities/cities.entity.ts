import crypto from 'node:crypto'

export class City {
  constructor(
    public idCity: string,
    public name: string,
    public idProvince: string
    )  {}
}