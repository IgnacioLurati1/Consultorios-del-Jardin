import "../CRUDSLabel.css";


export function ProvinceLabel(props: {name: string, id: string, onDelete: (id: string) => void, onEdit: (id: string) => void, active: boolean}) {

  return (
    <div className={`${props.active ? 'crud-label-green' : 'crud-label-red'} crud-label`}>
      <p className="crud-name"><strong>{props.name}</strong></p>
      <p className="crud-id"><strong>ID : {props.id}</strong></p>
    </div>
  );
}