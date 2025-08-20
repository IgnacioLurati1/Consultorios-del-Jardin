import "../CRUDSLabel.css";



export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, provinces: string , onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label`}>
      <p className="crud-name"><strong>{office.description}</strong></p> 
      <p className="crud-id"><strong>ID : {office.id}</strong></p>
      <p className="crud-id">
                Horario de Apertura: {office.openingTime}   
                {" / "}
                Horario de Cierre: {office.closingTime}
                <br />
                {office.city}, {office.provinces}.
      </p>
    </div>
  );
}
