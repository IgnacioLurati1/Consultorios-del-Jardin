import { FaAngleDown } from "react-icons/fa";
import "../../scheduleProfessional/gridFilter/gridFilter.css"
import {useEffect, useState } from "react";
import type { Appointment, Office } from "../../types.ts";
import { FaXmark } from "react-icons/fa6";

interface AppointmentsGridFilterProps {
    appointments: Appointment[];
    offices: Office[];
    peopleMap: Map<string,string>;
    setOfficeToFilter: (office: Office|undefined) => void;
    acceptedFilter: boolean;
    setAcceptedFilter: (value: boolean) => void;
    attendedFilter: boolean;
    setAttendedFilter: (value: boolean) => void;
    unattendedFilter: boolean;
    setUnattendedFilter: (value: boolean) => void;
    pendingFilter: boolean;
    setPendingFilter: (value: boolean) => void;
    setPersonToFilter:(email: string | undefined) => void;
    userType: string;
}

interface filterPerson {
  email: string;
  name: string;
};

export function AppointmentsGridFilter({ appointments,
  offices,
  setOfficeToFilter,
  acceptedFilter,
  setAcceptedFilter,
  attendedFilter,
  setAttendedFilter,
  unattendedFilter,
  setUnattendedFilter,
  pendingFilter,
  setPendingFilter,
  peopleMap,
  setPersonToFilter,
  userType  }: AppointmentsGridFilterProps) {
    const [toggleOptions, setToggleOptions] = useState(false);
    const [list, setList] = useState(false);
    const [listPeople, setListPeople] = useState(false);
    const [appointmentOffices, setAppointmentOffices] = useState<Office[]>([]);
    const [filteredAppointmentOffices, setFilteredAppointmentOffices] = useState<Office[]>([]);
    const[masterPeopleList, setMasterPeopleList] = useState<filterPerson[]>();
    const[filteredPeopleList, setFilteredPeopleList] = useState<filterPerson[]>();

    useEffect(() => {
        if (appointments && offices) {
            
            const officeIds = new Set<number>();
            appointments.forEach(app => {
                officeIds.add(Number(app.room.office.idOffice));
            });

            const filtered = offices.filter(o => officeIds.has(Number(o.idOffice)));
            
            setAppointmentOffices(filtered);
            setFilteredAppointmentOffices(filtered);
        } 
    }, [toggleOptions, appointments, offices]);


        useEffect(() => {
    if (!peopleMap) return; // Si el map está vacío, no hace nada

    const people = Array.from(peopleMap, ([email, name]) => ({ email, name }));

    people.sort((a, b) => a.name.localeCompare(b.name));
    
    setMasterPeopleList(people); 
    setFilteredPeopleList(people); 

    }, [peopleMap]); 

    function FilterOffices(text: string){
      const lowertext = text.toLocaleLowerCase();
      const filtered = appointmentOffices.filter( off => off.description.toLocaleLowerCase().includes(lowertext) 
      || off.city.nameCity.toLocaleLowerCase().includes(lowertext) 
      ||off.city.province.nameProvince.toLocaleLowerCase().includes(lowertext))
      setFilteredAppointmentOffices(filtered)
    }

    function FilterPeople(email:string){
      const lowertext = email.toLocaleLowerCase();
      const filtered = masterPeopleList?.filter(p => p.email.toLocaleLowerCase().includes(lowertext) 
      || p.name.toLocaleLowerCase().includes(lowertext) )
      setFilteredPeopleList(filtered)
    }

    function cancelFilters() {
    setOfficeToFilter(undefined);
    setAcceptedFilter(false);
    setAttendedFilter(false);
    setUnattendedFilter(false);
    setPendingFilter(false);
    setPersonToFilter(undefined)
  }

    return (
    <div className="filter-container">
      <div className="filter-selector" onClick={() => setToggleOptions(!toggleOptions)}>Filtros<FaAngleDown className={toggleOptions ? "icon rotated" : "icon"} /></div>
      <div className={"filter-options" + (toggleOptions ? " active" : " disabled")}>
        <div className="single-filter delete-filters" onClick={() => cancelFilters()}><FaXmark />Borrar filtros</div>
        
        <div className="single-filter checkbox-filter">
          <label className="checkbox-filter-label">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={unattendedFilter}
              onChange={(e) => setUnattendedFilter(e.target.checked)}
            /> No atendidos
          </label>
        </div>
        <div className="single-filter checkbox-filter">
          <label className="checkbox-filter-label">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={attendedFilter}
              onChange={(e) => setAttendedFilter(e.target.checked)}
            /> Atendidos
          </label>
        </div>
        <div className="single-filter checkbox-filter">
          <label className="checkbox-filter-label">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={acceptedFilter}
              onChange={(e) => setAcceptedFilter(e.target.checked)}
            /> Aceptados
          </label>
        </div>
        <div className="single-filter checkbox-filter">
          <label className="checkbox-filter-label">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.checked)}
            /> Pendientes
          </label>
        </div>
        
        <div className="filter-option">
          <div className="filter-input-container" onClick={() => setListPeople(!listPeople)}>
            <input className="filter-input" placeholder={userType == "professional"? "Paciente" : "Profesional"} type="text" onChange={(e) => FilterPeople(e.target.value)} onClick={(event) => event.stopPropagation()} />
            <FaAngleDown className={listPeople ? "icon rotated list-icon" : "icon list-icon"} />
          </div>
          <ul className={"filter-list" + (listPeople ? " active" : " disabled")}>
            {filteredPeopleList?.map((p) => (
              <li className="filter-list-item" key={p.email} onClick={() => { setPersonToFilter(p.email) }}>{p.name}</li>
            ))}
          </ul>
        </div>

        <div className="filter-option">
          <div className="filter-input-container" onClick={() => setList(!list)}>
            <input className="filter-input" placeholder="Consultorios" type="text" onChange={(e) => FilterOffices(e.target.value)} onClick={(event) => event.stopPropagation()} />
            <FaAngleDown className={list ? "icon rotated list-icon" : "icon list-icon"} />
          </div>
          <ul className={"filter-list" + (list ? " active" : " disabled")}>
            {filteredAppointmentOffices.map((of) => (
              <li className="filter-list-item" key={of.idOffice} onClick={() => { setOfficeToFilter(of) }}>{of.description} - {of.city.nameCity} - {of.city.province.nameProvince}</li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}

