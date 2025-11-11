import { FaAngleDown } from "react-icons/fa";
import "../../scheduleProfessional/gridFilter/gridFilter.css"
import {useEffect, useState } from "react";
import type { Appointment, Office } from "../../types.ts";
import { FaXmark } from "react-icons/fa6";

interface AppointmentsGridFilterProps {
    appointments: Appointment[];
    offices: Office[];
    setOfficeToFilter: (office: Office|undefined) => void;
}

export function AppointmentsGridFilter({ appointments, offices, setOfficeToFilter }: AppointmentsGridFilterProps) {
    const [toggleOptions, setToggleOptions] = useState(false);
    const [list, setList] = useState(false);
    const [appointmentOffices, setAppointmentOffices] = useState<Office[]>([]);
    const [filteredAppointmentOffices, setFilteredAppointmentOffices] = useState<Office[]>([]);

    useEffect(() => {
        if (appointments && offices) {
            
            const officeIds = new Set<number>();
            appointments.forEach(app => {
                officeIds.add(Number(app.room.office.idOffice));
            });

            // 2. Filtra la lista "maestra" de offices usando esos IDs
            const filtered = offices.filter(o => officeIds.has(Number(o.idOffice)));
            
            // 3. Setea los estados con los objetos Office COMPLETOS
            setAppointmentOffices(filtered);
            setFilteredAppointmentOffices(filtered);
        } 
    }, [toggleOptions, appointments, offices]);


    function FilterOffices(text: string){
      const lowertext = text.toLocaleLowerCase();
      const filtered = appointmentOffices.filter( off => off.description.toLocaleLowerCase().includes(lowertext) 
      || off.city.nameCity.toLocaleLowerCase().includes(lowertext) 
      ||off.city.province.nameProvince.toLocaleLowerCase().includes(lowertext))
      setFilteredAppointmentOffices(filtered)
    }

    function cancelFilters(){
      setOfficeToFilter(undefined)
    }

    return(
    <div className="filter-container">
            <div className="filter-selector" onClick={() => setToggleOptions(!toggleOptions)}>Filtros<FaAngleDown className={toggleOptions ? "icon rotated" : "icon"} /></div>
            <div className={"filter-options" + (toggleOptions ? " active" : " disabled")}>
              <div className="delete-filters" onClick={() => cancelFilters()}><FaXmark/>Borrar filtros</div>
              <div className="filter-option">
                <div className="filter-input-container" onClick={() => setList(!list)}>
                  <input className="filter-input" placeholder="Consultorios" type="text" onChange={(e) => FilterOffices(e.target.value)} onClick={(event)=> event.stopPropagation()}/>
                  <FaAngleDown className={list ? "icon rotated list-icon" : "icon list-icon"}/>
                </div>
                <ul className={"filter-list" + (list ? " active" : " disabled")}>
                  {filteredAppointmentOffices.map((of) => (
                    <li className="filter-list-item" key={of.idOffice} onClick={()=>{setOfficeToFilter(of)}}>{of.description} - {of.city.nameCity} - {of.city.province.nameProvince}</li>
                  ))}
                </ul>
              </div>

            </div>
    </div>
)
}

