import { FaAngleDown } from "react-icons/fa";
import "./gridFilter.css"
import {useEffect, useState } from "react";
import type{ Person, Office, Room } from "../../types.ts"
import type {GridFilterProps} from "../scheduleTypes.ts"

export function GridFilter({ setProfessional, professionals, schedules, offices, setRoomToFilter, setOfficeToFilter }: GridFilterProps){

    const [toggleOptions, setToggleOptions] = useState(false);
    const [list1, setList1] = useState(false);
    const [list2, setList2] = useState(false)
    const [list3, setList3] = useState(false)
    const [filteredProfessionalsList, setFilteredProfessionalsList] = useState<Person[]>([]);
    const [scheduleOffices, setScheduleOffices] = useState<Office[]>([]);
    const [filteredScheduleOffices, setFilteredScheduleOffices] = useState<Office[]>([]);
    const [scheduleRooms, setScheduleRooms] = useState<Room[]>([]);
    const [filteredScheduleRooms, setFilteredScheduleRooms] = useState<Room[]>([]);
    const [choicedOffice, setChoicedOffice] = useState<Office|undefined>(undefined)
    
    useEffect(() => {
      if (toggleOptions && professionals) {
        setFilteredProfessionalsList(professionals);
      }                                                  //Cuando se aprieta el boton, se setean los profesionales
      if(schedules){
        const rooms = schedules.map(s => s.room)      //Si hay shcedules se buscan sus rooms
        setScheduleRooms(rooms)
      } 
    }, [toggleOptions, schedules]);

    useEffect(() => {
      if (scheduleRooms.length && offices) {

        const officeIds = new Set(scheduleRooms.map(r => String(r.office)));                                                  //Se obtienen los ids de las offices de las rooms

        const filtered = offices.filter(o => officeIds.has(String(o.idOffice)));    //Se obtienen las offices con ese id

        setScheduleOffices(filtered);
        setFilteredScheduleOffices(filtered)
      }
    }, [scheduleRooms, offices]);

    useEffect(()=>{
      setFilteredScheduleRooms(scheduleRooms.filter(room => String(room.office) == String(choicedOffice?.idOffice)))//Se setea la lista de rooms para el filtro, solo si hay una office elegida
    },[choicedOffice])

    function FilterProf(text: string){
      const lowertext = text.toLowerCase();
      const filtered = professionals?.filter((profesional) =>
        profesional.name.toLowerCase().includes(lowertext) || profesional.surname.toLowerCase().includes(lowertext)
      );
      if(filtered){setFilteredProfessionalsList(filtered);}
    }

    function FilterOffices(text: string){
      const lowertext = text.toLocaleLowerCase();
      const filtered = scheduleOffices.filter( off => off.description.toLocaleLowerCase().includes(lowertext) 
      || off.city.nameCity.toLocaleLowerCase().includes(lowertext) 
      ||off.city.province.nameProvince.toLocaleLowerCase().includes(lowertext))
      setFilteredScheduleOffices(filtered)
    }

    function FilterRooms(text: string){
      const lowertext = text.toLocaleLowerCase();
      const filtered = scheduleRooms.filter( room => room.description.toLocaleLowerCase().includes(lowertext))
      setFilteredScheduleRooms(filtered)
    }

    return(
    <div className="filter-container">
            <div className="filter-selector" onClick={() => setToggleOptions(!toggleOptions)}>Filtros<FaAngleDown className={toggleOptions ? "icon rotated" : "icon"} /></div>
            <div className={"filter-options" + (toggleOptions ? " active" : " disabled")}>
              <div className="filter-option">
                {professionals?(<>
                <div className="filter-input-container" onClick={() => setList1(!list1)}>
                  <input className="filter-input" placeholder="Profesional" type="text" onChange={(e) => FilterProf(e.target.value)} onClick={(event)=> event.stopPropagation()}/>
                  <FaAngleDown className={list1 ? "icon rotated list-icon" : "icon list-icon"}/>
                </div>
                <ul className={"filter-list" + (list1 ? " active" : " disabled")}>
                  {filteredProfessionalsList.map((profesional) => (
                    <li className="filter-list-item" key={profesional.email} onClick={() => {setProfessional(profesional)}}>{profesional.name}, {profesional.surname}</li>
                  ))}
                </ul></>):(<>
                </>)}
              </div>
              <div className="filter-option">
                <div className="filter-input-container" onClick={() => setList2(!list2)}>
                  <input className="filter-input" placeholder="Consultorios" type="text" onChange={(e) => FilterOffices(e.target.value)} onClick={(event)=> event.stopPropagation()}/>
                  <FaAngleDown className={list2 ? "icon rotated list-icon" : "icon list-icon"}/>
                </div>
                <ul className={"filter-list" + (list2 ? " active" : " disabled")}>
                  { filteredScheduleOffices.length? ( // Si no hay profesional, no hay lista de schedules, muestra que lo elija
                  filteredScheduleOffices.map((of) => (
                    <li className="filter-list-item" key={of.idOffice} onClick={()=>{setChoicedOffice(of);setOfficeToFilter(of)}}>{of.description} - {of.city.nameCity} - {of.city.province.nameProvince}</li>
                  ))):
                  (<li className="filter-list-item">Seleccione un profesional</li>)}
                </ul>
              </div>
              <div className="filter-option">
                <div className="filter-input-container" onClick={() => setList3(!list3)}>
                  <input className="filter-input" placeholder="Salas" type="text" onChange={(e) => FilterRooms(e.target.value)} onClick={(event)=> event.stopPropagation()}/>
                  <FaAngleDown className={list3 ? "icon rotated list-icon" : "icon list-icon"}/>
                </div>
                <ul className={"filter-list" + (list3 ? " active" : " disabled")}>
                  {choicedOffice ? ( // Si no hay una office elegida, no trae los rooms
                  filteredScheduleRooms.map((room) => (
                    <li className="filter-list-item" key={room.idRoom} onClick={()=>setRoomToFilter(room)}>{room.description}</li>
                  ))
                  ) : (
                  <li className="filter-list-item">Elija un consultorio</li>
                  )}
                </ul>
              </div>

            </div>
    </div>
)
}
