
interface OfficeLabelProps {
  office: {
    idOffice: string; 
    description: string;
    openingTime: string;
    closingTime: string;
    active: boolean;
    city: {
      idCity: string;
        nameCity: string;
        province: {
            idProvince: string;
            nameProvince: string;
        };
    };
  };
}

export function OfficeLabel({ office }: OfficeLabelProps) {
    
    return (
        <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label`}>
            <p className="crud-name"><strong>{office.description}</strong></p> 
            <p className="crud-id"><strong>ID : {office.idOffice}</strong></p>
            <p className="crud-time">
                <strong>Horario de Apertura: {office.openingTime}</strong> | 
                <strong> Horario de Cierre: {office.closingTime}</strong>
                <p className="crud-province">{office.city?.nameCity || 'Unknown City'}</p>
                <p className="crud-city">{office.city?.province?.nameProvince || 'Unknown Province'}</p>
            </p>  
        </div>
            );
            
        };