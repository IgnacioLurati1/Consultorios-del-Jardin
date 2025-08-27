import "../CRUDSLabel.css";

export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label office-label`}>
        <p className="crudName">{office.description}</p>
        <p className="crud-id">ID: {office.id}</p>
    </div>
  );
}

//no es responsive.