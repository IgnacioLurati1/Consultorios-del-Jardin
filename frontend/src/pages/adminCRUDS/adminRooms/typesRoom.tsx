import type {City,Office,Room} from "../../types.ts"
export interface RoomModalProps {
    visible: boolean;

    room: Room | null;

    offices: Office[];
    
    cities: City[];

    onClose: () => void;

    onDelete: (idRoom: string) => void;

    onEdit : (UpdatedRoom: {
        idRoom: string;
        description: string;
        office: string;
    }, 
    active: boolean
    ) => void;

    onCreate: (newRoom: {
        description: string;
        office: string;
    }) => void;

    type: string;
}

export interface RoomLabelProps {
    room: Room;
    active?: boolean;
}
