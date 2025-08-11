import "../styles/ProvinceLabel.css";


export function ProvinceLabel(props: {name: String, id: String, onDelete: (id: String) => void, onEdit: (id: String) => void}) {
  return (
    <div className="province-label">
      <p className="province-name">{props.name}</p>
      <p className="province-id">Id: {props.id}</p>
    </div>
  );
}