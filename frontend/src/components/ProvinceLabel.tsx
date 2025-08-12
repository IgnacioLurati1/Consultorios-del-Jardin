import "../styles/ProvinceLabel.css";


export function ProvinceLabel(props: {name: String, id: String, onDelete: (id: String) => void, onEdit: (id: String) => void}) {
  return (
    <div className="province-label">
      <p className="province-name"><strong>{props.name}</strong></p>
      <p className="province-id"><strong>ID : {props.id}</strong></p>
    </div>
  );
}