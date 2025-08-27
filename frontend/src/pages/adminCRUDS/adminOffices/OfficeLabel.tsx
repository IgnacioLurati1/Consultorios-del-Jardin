import "../CRUDSLabel.css";


export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, provinces: string , onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label city-label`}>
      <p className="crud-name"><strong>ID: {office.id}</strong></p>
      <p className= "crud-name">{office.description}
      <br></br>
      de {office.openingTime}hs a {office.closingTime}hs
      </p>
      <p className="crud-id">{office.city}, {office.provinces}.</p>  
    </div>
  );
}
//comentario
