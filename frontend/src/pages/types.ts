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
