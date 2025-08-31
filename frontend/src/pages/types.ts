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
