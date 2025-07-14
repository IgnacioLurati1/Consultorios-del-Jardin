import "../styles/ProvinceLabel.css";


export function ProvinceLabel(props: {name: String, id: String}) {
  return (
    <div className="province-label">
      <p>Nombre: {props.name}</p>
      <p>Id: {props.id}</p>
      <p> Eliminar </p>
      <p> Modificar </p>
    </div>
  );
}