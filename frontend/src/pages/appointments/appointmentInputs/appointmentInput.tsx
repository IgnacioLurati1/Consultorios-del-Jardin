import { useState, useEffect } from 'react';
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import { toast } from "react-toastify";
import type{Office, Person} from "../../types.ts"
import './appointmentInput.css';
import { findAllActiveProfessionals, findProfessionalsOfficeSpecialty } from "../../adminCRUDS/adminUsers/usersService.ts";
import { FaExclamationTriangle, FaAngleDown } from "react-icons/fa";
import { ProfessionalCard } from './professionalCard.tsx';

export function AppointmentInput() {

const [officesList, setOfficesList] = useState<Office[] | []>([]);
const [office, setOffice] = useState<Office>();
const [filteredOffices, setFilteredOffices] = useState<Office[] | []>([]);
const [officeSelector, setOfficeSelector] = useState(false);
const [officeInputValue, setOfficeInputValue] = useState<string>('');

const [specialtiesList, setSpecialtiesList] = useState<string[] | []>([]);
const [specialty, setSpecialty] = useState<string>();
const [filteredSpecialties, setFilteredSpecialties] = useState<string[] | []>([]);
const [specialtySelector, setSpecialtySelector] = useState(false);
const [specialtyInputValue, setSpecialtyInputValue] = useState<string>('');

const [professionalsList, setProfessionalsList] = useState<Person[] | []>([]);
const [filteredProfessionals, setFilteredProfessionals] = useState<Person[] | []>([]);

const [showAppointments, setShowAppointments] = useState(false);
const [errors, setErrors] = useState<{office?:string ,professional?:string, specialty?: string}>({});


function validateInputs(){
        const newErrors: typeof errors = {};

        if(!office){
            newErrors.office = "El consultorio es obligatorio"
            setOfficeSelector(false);
        }
        /*if(!specialty && !professional && !office){
            newErrors.specialty = "Ingrese un profesional o una especialidad"
        }*/

        setErrors(newErrors);

        if( Object.keys(newErrors).length ===0){
            return true
        }else 
            {return false}
    }

useEffect(() => {
    findAllActiveOffices()
    .then(data => {
        setOfficesList(data);
        setFilteredOffices(data);
    })
    .catch(err => {
        toast.error("Error cargando salas:", err);
    });
}, []);

useEffect(() => {
    findAllActiveProfessionals()
    .then(data => {
        setProfessionalsList(data);
        const specialties = [...new Set(data.map(p => p.speciality))];
        setSpecialtiesList(specialties);
        setFilteredSpecialties(specialties);

    })
    .catch(err => {
        toast.error("Error cargando profesionales:", err);
    });
}, []);

function findFilteredProfessionals(){
    if ((office && specialty) || (office)){
        findProfessionalsOfficeSpecialty(String(office.idOffice),specialty)
        .then(data => {
            setFilteredProfessionals(data);
            
        })
        .catch(err => {
            toast.error("Error cargando profesionales con ese consultorio y esa oficina:", err);
        });
    }
}

const handleSearch = () => {
    if(!validateInputs()) {
            toast.dismiss();
        return;}
    setShowAppointments(true);
    findFilteredProfessionals();
};

function FilterOffices(text: string){
      const lowertext = text.toLocaleLowerCase();
      const filtered = officesList.filter( off => off.description.toLocaleLowerCase().includes(lowertext) 
      || off.city.nameCity.toLocaleLowerCase().includes(lowertext) 
      ||off.city.province.nameProvince.toLocaleLowerCase().includes(lowertext))
      setFilteredOffices(filtered)
    }

function FilterSpecialties(text: string){
    const lowertext = text.toLocaleLowerCase();
    const filtered = specialtiesList.filter( spe => spe.toLocaleLowerCase().includes(lowertext))
    setFilteredSpecialties(filtered)
}

return (
    <>
        <div className= {showAppointments ? 'appointments-input-container reduced' : 'appointments-input-container'}>
            <div className={showAppointments ? 'appointment-input-content reduced' : 'appointment-input-content'}>
                <div className="appointment-input-title"> Encontrá tu turno</div>
                <div className="appointment-input-card">
                    <div className="appointment-input-form-grid">
                        <div className="appointment-input-form-field">
                            <label className="appointment-input-form-label">Consultorio</label>
                            <div className="appointment-input-form-select" onClick={() => setOfficeSelector(!officeSelector)}>
                                <input 
                                    className="appointment-input-filter-input" 
                                    placeholder="Buscá por consultorio" 
                                    value={officeInputValue}
                                    type="text"
                                    onChange={(e) => {
                                        setOfficeInputValue(e.target.value);
                                        FilterOffices(e.target.value); 
                                        if(!officeSelector) setOfficeSelector(true);
                                    }} 
                                    onFocus={() => {
                                        if(!officeSelector) setOfficeSelector(true);
                                    }}
                                    onClick={(event) => {event.stopPropagation()
                                                        setOfficeSelector(true)
                                    }} 
                                />
                                <FaAngleDown className={officeSelector ? "appointment-input-icon rotated list-icon" : "appointment-input-icon list-icon"} />
                            </div>
                            {officeSelector && (
                            <ul className={"appointment-input-filter-list" + (officeSelector ? " active" : " disabled")}>
                                    {filteredOffices.length > 0 ? (
                                        filteredOffices.map((of) => (
                                            <li 
                                                className="appointment-input-filter-list-item" 
                                                key={of.idOffice} 
                                                onClick={() => { 
                                                    setOffice(of);
                                                    setOfficeInputValue(`${of.description} - ${of.city.nameCity} - ${of.city.province.nameProvince}`);
                                                    setOfficeSelector(false);
                                                }}
                                            >
                                                {of.description} - {of.city.nameCity} - {of.city.province.nameProvince}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="appointment-input-filter-list-item no-results">No se encontraron resultados</li>
                                    )}
                                </ul>
                            )}
                                <div className="appointment-input-error-container">
                                {errors.office && 
                                    <div className="appointment-input-error-text">
                                        <FaExclamationTriangle className="appointment-input-error-icon"/>{errors.office}
                                    </div>
                                }
                            </div>
                        </div>
                        

                        {/*<div className="form-field">
                            <label className="form-label"> Profesional</label>
                            <select 
                                    className="form-select"
                                    value={professional?.email || ""} 
                                    onFocus={() => {
                                        setProfessional(undefined);
                                    }}
        
                                    onChange={(e) => {
                                        const selectedProfessional = professionalsList.find(r => r.email == e.target.value);
                                        
                                        if (selectedProfessional){
                                            setProfessional(selectedProfessional);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Buscá por profesional</option>
                                    {professionalsList.map((prof)=>
                                        <option key={prof.email} value={prof.email}>{prof.name+ ", " + prof.surname}</option>
                                    )}
                                </select>
                                <div className="error-container">
                                {errors.professional && 
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.professional}
                                    </div>}
                                </div>
                        </div>*/}

                        <div className="appointment-input-form-field">
                            <label className="appointment-input-form-label">Especialidad</label>
                            <div className="appointment-input-form-select" onClick={() => setSpecialtySelector(!specialtySelector)}>
                                <input 
                                    className="appointment-input-filter-input" 
                                    placeholder="Buscá por especialidad" 
                                    value={specialtyInputValue}
                                    type="text"
                                    onChange={(e) => {
                                        setSpecialtyInputValue(e.target.value);
                                        FilterSpecialties(e.target.value); 
                                        if(!specialtySelector) setSpecialtySelector(true);
                                    }} 
                                    onFocus={() => {
                                        if(!specialtySelector) setSpecialtySelector(true);
                                    }}
                                    onClick={(event) => {event.stopPropagation()
                                                        setSpecialtySelector(true)
                                    }} 
                                />
                                <FaAngleDown className={specialtySelector ? "appointment-input-icon rotated list-icon" : "appointment-input-icon list-icon"} />
                            </div>
                            {specialtySelector && (
                            <ul className={"appointment-input-filter-list" + (specialtySelector ? " active" : " disabled")}>
                                <li className="appointment-input-filter-list-item" onClick={() => { 
                                setSpecialty(undefined);
                                setSpecialtyInputValue('');
                                setSpecialtySelector(false);
                            }}>Caulquier especialidad</li>
                                    {filteredSpecialties.length > 0 ? (
                                        filteredSpecialties.map((spe) => (
                                            <li 
                                                className="appointment-input-filter-list-item" 
                                                key={spe} 
                                                onClick={() => { 
                                                    setSpecialty(spe);
                                                    setSpecialtyInputValue(spe);
                                                    setSpecialtySelector(false);
                                                }}
                                            >
                                                {spe}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="appointment-input-filter-list-item no-results">No se encontraron resultados</li>
                                    )}
                                </ul>
                            )}
                        </div>

                    </div>

                    <div className="appointment-input-form-actions">
                        <div className="appointment-input-form-hint">
                            {showAppointments ? `${filteredProfessionals.length} resultados encontrados` : "Ingrese consultorio y/o especialidad"}
                        </div>

                        <button onClick={handleSearch} className="appointment-input-search-button">
                            Buscar turnos
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div className={showAppointments ? 'appointment-input-results-container' : 'appointment-input-results-container hidden'}>
            <div className="appointment-input-professionals-results-content">
                {
                    filteredProfessionals.length === 0 ? (
                    <div>
                        <h2 className="appointment-input-no-results-title">No se encontraron resultados</h2>
                    </div>
                    ) : (
                    showAppointments && filteredProfessionals.map((professional) => (
                        <ProfessionalCard key={professional.email} professional={professional} office={office} display={showAppointments}/>
                    ))
                    )
                }
            </div>
        </div>
    </>
    );
};