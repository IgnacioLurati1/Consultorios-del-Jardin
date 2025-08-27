import "../CRUDSLabel.css";


export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, provinces: string , onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} .city-label .crud-name`}>
      <li className="crud-create-entity-input">
      <p className="crud-name">ID {office.id}. {office.description}</p> 
      <p className="crud-name">Horario: de {office.openingTime}hs a {office.closingTime}hs</p>     
      <p className="crud-name">{office.city}, {office.provinces}.</p>
      </li>
    </div>
  );
}
