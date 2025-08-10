import "../styles/ProvinceLabel.css";


export function ProvinceLabel(props: {name: String, id: String, onDelete: (id: String) => void, onEdit: (id: String) => void}) {
  return (
    <div className="province-label">
      <p className="province-name">Nombre: {props.name}</p>
      <p>Id: {props.id}</p>
    </div>
  );
}