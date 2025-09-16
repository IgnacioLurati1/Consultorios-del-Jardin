import { FaAngleDown } from "react-icons/fa";
import "./gridFilter.css"
import {useEffect, useState } from "react";
import type{ Person } from "../../types.ts"
interface GridFilterProps{
  setProfessional: (profesionals: Person | undefined) => void;
  professionals?: Person[];
}

export function GridFilter({ setProfessional, professionals }: GridFilterProps){

    const [toggleOptions, setToggleOptions] = useState(false);
    const [List1, setList1] = useState(false);
    const [listaProfesionalesFiltrada, setListaProfesionalesFiltrada] = useState<(Person|undefined)[]>([]);
    
    useEffect(() => {
      if (toggleOptions && professionals) {
        setListaProfesionalesFiltrada(professionals);
      }
    }, [toggleOptions]);

    function FilterProf(text: string){
      const lowertext = text.toLowerCase();
      const filtered = listaProfesionalesFiltrada.filter((profesional) =>
        profesional?.name.toLowerCase().includes(lowertext) || profesional?.surname.toLowerCase().includes(lowertext)
      );
      setListaProfesionalesFiltrada(filtered);
    }

    return(
    <div className="filter-container">
            <div className="filter-selector" onClick={() => setToggleOptions(!toggleOptions)}>Filtros<FaAngleDown className={toggleOptions ? "icon rotated" : "icon"} /></div>
            <div className={"filter-options" + (toggleOptions ? " active" : " disabled")}>
              <div className="filter-option">
                {professionals?(<>
                <div className="filter-input-container" onClick={() => setList1(!List1)}>
                  <input className="filter-input" placeholder="Profesional" type="text" onChange={(e) => FilterProf(e.target.value)} onClick={(event)=> event.stopPropagation()}/>
                  <FaAngleDown className={List1 ? "icon rotated list-icon" : "icon list-icon"}/>
                </div>
                <ul className={"filter-list" + (List1 ? " active" : " disabled")}>
                  {listaProfesionalesFiltrada.map((profesional) => (
                    <li className="filter-list-item" key={profesional?.email} onClick={() => {setProfessional(profesional)}}>{profesional?.name}, {profesional?.surname}</li>
                  ))}
                </ul></>):(<>
                </>)}
              </div>
              {/*HAY QUE HACER LO MISMO CON LAS OTRAS OPCIONES DE FILTRADO, NO LO HAGO AHORA PORQUE NO TENEMOS EL BACK DESARROLLADO, ASI NO SE HACEN COSAS INNECESARIAS QUE PUEDEN
              ESTAR MAL*/}

            </div>
    </div>
)
}
