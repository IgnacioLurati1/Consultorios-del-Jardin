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
    description: string;
    openingTime: string;
    closingTime: string;
    city: City
    active: boolean;
}

export interface Room {
    idRoom: string;
    description: string;
    office: Office;
    active: boolean;
}

export interface Person{
    email: string;
    docType: string;
    docNumber: string;
    name: string;
    surname: string;
    phoneNumber: string;
    password: string;
    speciality: string;
    type: string;
    active: boolean;
}

export interface Schedule {
    day: string;
    initialHour: string;
    Person: string;
    Room: string;
    finalHour: string;
    state: boolean;
    allowedType: "simple" | "workshop";
}
