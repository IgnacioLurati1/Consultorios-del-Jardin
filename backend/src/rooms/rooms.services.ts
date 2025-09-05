    import { orm } from '../shared/db/orm.js';
    import { Room } from './rooms.entity.js';
    //import { OfficeService } from '../offices/offices.service.js'; ----------- FALTA LO DE ALAN -
    import type { RequiredEntityData } from '@mikro-orm/core';

    const em = orm.em;
    export class RoomService {

        //constructor(private officeService = new OfficeService()) {} ----------- FALTA LO DE ALAN -


        //VALIDATIONS


        async validateRoomAdd(sanitizedInput: any): Promise<string[]> {
        const errors: string[] = []

        if (sanitizedInput.description === undefined || sanitizedInput.description === "") {
        errors.push('La descripción de la sala es obligatorio');
        }
        else {
            if (typeof sanitizedInput.description !== 'string') {
            errors.push('La descripción de la sala debe ser una cadena de texto');
        } 
        if (sanitizedInput.description.length < 2) {
            errors.push('La descripción de la sala es obligatoria y debe tener al menos 2 caracteres');
        } 
        if (sanitizedInput.description.length > 100) {
            errors.push('La descripción de la sala no puede tener más de 100 caracteres');
        } 
        if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.description)) {
            errors.push('La descripción de la sala solo puede contener letras, espacios, guiones y apóstrofes');
        }

        if(sanitizedInput.office === undefined || sanitizedInput.office === ''){
        errors.push('El consultorio es obligatorio')
        }/*else{
            try{
                const id = Number.parseInt(sanitizedInput.office)
                const office = await this.officeService.findOfficeById(id)
                if(office && !office.active){
                errors.push('La consultorio está deshabilitada')
                }
            }catch(error: any) {
                errors.push('Error al validar estado de la consultorio seleccionada')
            }
        } ----------- FALTA LO DE ALAN - */

        if(errors.length == 0){
            try {
                const existingRoom = await this.roomExistsWithDescriptionAndOffice(sanitizedInput.description, sanitizedInput.office);

                if (existingRoom) {
                    errors.push('Ya existe una sala con el mismo nombre en el misma consultorio')
                }
                }catch(error: any) {
                errors.push('Error al validar salas con mismo nombre')
        }
        }
        }

        return errors
    }

    async validateRoomUpdate(id: number, sanitizedInput: any): Promise<string[]> {
        const errors: string[] = []

        if ((sanitizedInput.description === undefined || sanitizedInput.description === "")&&(sanitizedInput.office === undefined || sanitizedInput.office === '')){
        errors.push('Se necesita al menos un campo, nombre o consultorio, para modificar');
        }
        else if(sanitizedInput.description !== "") {
        if (typeof sanitizedInput.description !== 'string') {
            errors.push('La descripción de la sala debe ser una cadena de texto');
        } 
        if (sanitizedInput.description.length < 2) {
            errors.push('La descripción de la sala es obligatoria y debe tener al menos 2 caracteres');
        } 
        if (sanitizedInput.description.length > 100) {
            errors.push('La descripción de la sala no puede tener más de 100 caracteres');
        } 
        if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.description)) {
            errors.push('La descripción de la sala solo puede contener letras, espacios, guiones y apóstrofes');
        }
        }
        
        /*if(sanitizedInput.office !== ""){
        try{
            const idOffice = Number.parseInt(sanitizedInput.office)
            const office = await this.officeService.findOfficeById(idOffice)
            if(office && !office.active){
            errors.push('La consultorio está deshabilitada')
            }
        }catch(error: any) {
            errors.push('Error al validar estado de la consultorio seleccionada, asegúrese de ingresar una consultorio existente')
        }
        } ----------- FALTA LO DE ALAN - */
        

        if(errors.length == 0){
            try {
                const existingRoom = await this.roomExistsWithDescriptionAndOffice(sanitizedInput.description, sanitizedInput.office, id);

                if (existingRoom) {
                    errors.push('Ya existe una sala con el mismo nombre en el mismo consultorio')
                }
                }catch(error: any) {
                errors.push('Error al validar salas con mismo nombre')
        }
        }

        return errors
    }

    //SERVICES

    async findAllRooms(): Promise<Room[]> {
        let rooms = await em.find(Room, {}, { populate: ['office.city'] });
        rooms = rooms.filter(room => room.office.active) ; //Filter all rooms by its office state
        return rooms;
    }



    async findAllActiveRooms(): Promise<Room[]> {
        let rooms = await em.find(Room, {}, { populate: ['office.city'] });
        rooms = rooms.filter(room => room.office.active && room.active); //Filter all rooms by its office state and its own state
        return rooms;
    }



    async findRoomById(idRoom:number): Promise<Room>{
        return await em.findOneOrFail(Room, { idRoom }, { populate: ['office.city']})
    }


    
    async createRoom(data: RequiredEntityData<Room>): Promise<Room> {
        const errors = await this.validateRoomAdd(data)

        const room = em.create(Room, data);
        await em.flush();

        return await em.findOneOrFail(Room, { idRoom: room.idRoom }, { populate: ['office'] })

    }

    async updateRoom(id:number, data:Partial<Room>): Promise<Room>{
        const errors = await this.validateRoomUpdate(id, data)
        
        if(errors.length > 0){
        throw new Error(errors.join(", "))
        }
        
        const room = await em.findOneOrFail(Room,  { idRoom : id })
        em.assign(room, data)
        await em.flush() 
        return await em.findOneOrFail(Room, { idRoom: id }, {populate: ['office.city']})
    }

    async toggleRoomState(id: number):Promise<Room>{
        const room = await em.findOneOrFail(Room,  { idRoom : id }, {populate: ['office']})

        room.active = !room.active;

        /*if (room.offices?.length > 0 && !room.active) {
        room.offices.map(office => office.active = room.active);
        } ----------- Aca iria si room tuviera una relacion donde algo dependa de ella, para hacer la baja en casacada - */

        await em.flush();
        return room;
    }

    async roomExistsWithDescriptionAndOffice(description: string, office: string, excludeId?: number) {
            const whereClause: any = { description: { $like: description.trim() }, office };
            if (excludeId) whereClause.idRoom = { $ne: excludeId };
            return await em.findOne(Room, whereClause);
    }
    
    }