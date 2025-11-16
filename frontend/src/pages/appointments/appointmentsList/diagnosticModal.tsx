import type { Appointment, Diagnostic } from "../../types.ts";

interface DiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment|undefined;
}

export function DiagnosticModal({ isOpen, onClose, appointment}: DiagnosticModalProps) {
    return null;
}