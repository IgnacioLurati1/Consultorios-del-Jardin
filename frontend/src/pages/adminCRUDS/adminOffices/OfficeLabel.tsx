import "../CRUDSLabel.css";


export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, provinces: string , onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label office-label`}>
      <div>
      <p className="crud-name"><strong>ID: {office.id}</strong> {office.description}</p>
      <p className= "crud-name"> De {office.openingTime}hs a {office.closingTime}hs </p>
      </div>
      <div>
        <p className="crud-id">{office.city}, {office.provinces}</p>
      </div>
    </div>
  );
}
//comentario
