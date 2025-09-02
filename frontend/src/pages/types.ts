export interface Province {
    idProvince: string;
    nameProvince: string;
    active: boolean;
}

export interface City {
        idCity: string;
        nameCity: string;
        province: Province;
        active: boolean;
    }

export interface Office {
    idOffice: string;
    openingTime: string;
    closingTime: string;
    description: string;
    active: boolean;
    city: City;
  }
