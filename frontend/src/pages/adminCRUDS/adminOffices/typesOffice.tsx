import type {City,Office, Province} from "../../types.ts"

export interface OfficeModalProps {
    visible: boolean;

    office: Office | null;
    
    cities: City[];

    provinces: Province[];

    onClose: () => void;

    onDelete: (idOffice: string) => void;

    onEdit : (UpdatedOffice: {
        idOffice: string;
        description: string;
        openingTime: string;
        closingTime: string;
        cityId: string;
    }, 
    active: boolean
    ) => void;

    onCreate: (newoffice: {
        description: string;
        openingTime: string;
        closingTime: string;
        cityId: string;
    }) => void;

    type: string;
}

export interface OfficeLabelProps {
    office: Office;
    active?: boolean;
}
