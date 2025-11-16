import {FaXmark } from "react-icons/fa6";

interface ConfirmCancelProps {
    setShowCancel(show: boolean): void;
    numAppointment: number;
    cancelAppointment(num: number): void;
}

export function ConfirmCancel({ setShowCancel, numAppointment, cancelAppointment }: ConfirmCancelProps){
    return (
        <div className="confirm-cancel-container" onClick={() => setShowCancel(false)}>
            <div className="confirm-cancel-box" onClick={e => e.stopPropagation()}>
                <div className="confirm-cancel-header">
                <div>Confirmar cancelación de turno</div>
                <div className="close-cancel" onClick={() => setShowCancel(false)}><FaXmark/></div>
                </div>
                <div className="confirm-cancel-body">
                <div>¿Está seguro que desea cancelar el turno?</div>
                </div>
                <div className="confirm-cancel-footer">
                <button className="confirm-cancel-button confirm-cancel" onClick={() => { cancelAppointment(numAppointment); setShowCancel(false); }}>Cancelar turno</button>
            </div>
            </div>
        </div>
    )
}