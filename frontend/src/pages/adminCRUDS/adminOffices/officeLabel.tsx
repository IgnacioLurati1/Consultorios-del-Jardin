interface OfficeLabelProps {
    office: {
        idOffice: string;
        description: string;
        openingTime: string;
        closingTime: string;
        active: boolean;
        city: {
            nameCity: string;
            province: {
                nameProvince: string;
            };
        };
    };
}

export function OfficeLabel({ office }: OfficeLabelProps) {
    return (
        <div className="office-label">
            <p className="idOffice">ID: {office.idOffice}</p>
            <p className="officeDescription">{office.description}</p>
            <p className="officeCity">{office.city?.nameCity ?? 'Sin ciudad'}, {office.city?.province?.nameProvince ?? 'Sin provincia'}</p>
            <p className="officeHours">Horario: {office.openingTime} - {office.closingTime}</p>
            <p className={`officeStatus ${office.active ? 'active' : 'inactive'}`}>{office.active ? 'Activo' : 'Inactivo'}</p>
        </div>
    );
}
