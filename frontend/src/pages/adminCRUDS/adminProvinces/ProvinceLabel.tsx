import "./ProvinceLabel.css";


export function ProvinceLabel(props: {name: String, id: String, onDelete: (id: String) => void, onEdit: (id: String) => void, active: boolean}) {

  return (
    <div className={`${props.active ? 'province-label-green' : 'province-label-red'} province-label`}>
      <p className="province-name"><strong>{props.name}</strong></p>
      <p className="province-id"><strong>ID : {props.id}</strong></p>
    </div>
  );
}