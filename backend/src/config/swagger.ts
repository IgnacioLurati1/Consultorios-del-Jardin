import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mi API',
      version: '1.0.0',
      description:
        'Cualquier endpoint autenticado responde 403 con { code: "USER_DISABLED" } ' +
        'si la persona duena del token tiene active = false (deshabilitada por el admin).',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Person: {
          type: 'object',
          properties: {
            email:       { type: 'string', example: 'juan@mail.com' },
            docType:     { type: 'string', example: 'DNI' },
            docNumber:   { type: 'string', example: '12345678' },
            name:        { type: 'string', example: 'Juan' },
            surname:     { type: 'string', example: 'Pérez' },
            phoneNumber: { type: 'string', example: '3511234567' },
            speciality:  { type: 'string', example: 'Cardiología' },
            type:        { type: 'string', enum: ['client', 'professional', 'admin'] },
            active:      { type: 'boolean' },
          },
        },
        PersonInput: {
          type: 'object',
          required: ['email', 'docType', 'docNumber', 'name', 'surname', 'phoneNumber', 'password', 'type'],
          properties: {
            email:       { type: 'string' },
            docType:     { type: 'string' },
            docNumber:   { type: 'string' },
            name:        { type: 'string' },
            surname:     { type: 'string' },
            phoneNumber: { type: 'string' },
            password:    { type: 'string' },
            speciality:  { type: 'string' },
            type:        { type: 'string', enum: ['client', 'professional'] },
            active:      { type: 'boolean', default: true },
          },
        },
        Room: {
          type: 'object',
          properties: {
            idRoom:      { type: 'integer', example: 1 },
            description: { type: 'string', example: 'Consultorio A' },
            active:      { type: 'boolean' },
            office:      { type: 'object', description: 'Oficina asociada' },
          },
        },
        RoomInput: {
          type: 'object',
          required: ['description', 'active', 'office'],
          properties: {
            description: { type: 'string', example: 'Consultorio A' },
            active:      { type: 'boolean', default: true },
            office:      { type: 'integer', description: 'ID de la oficina', example: 1 },
          },
        },
        Province: {
            type: 'object',
            properties: {
                idProvince:    { type: 'integer', example: 1 },
                nameProvince:  { type: 'string', example: 'Córdoba' },
                active:        { type: 'boolean' },
                cities:        { type: 'array', items: { type: 'object' } },
            },
            },
            ProvinceInput: {
            type: 'object',
            required: ['nameProvince', 'active'],
            properties: {
                nameProvince:  { type: 'string', example: 'Córdoba' },
                active:        { type: 'boolean', default: true },
            },
        },
        Office: {
            type: 'object',
            properties: {
                idOffice:     { type: 'integer', example: 1 },
                description:  { type: 'string', example: 'Oficina Central' },
                openingTime:  { type: 'string', example: '08:00' },
                closingTime:  { type: 'string', example: '18:00' },
                active:       { type: 'boolean' },
                city:         { type: 'object', description: 'Ciudad asociada' },
                rooms:        { type: 'array', items: { type: 'object' } },
            },
            },
            OfficeInput: {
            type: 'object',
            required: ['description', 'openingTime', 'closingTime', 'active', 'city'],
            properties: {
                description:  { type: 'string', example: 'Oficina Central' },
                openingTime:  { type: 'string', example: '08:00' },
                closingTime:  { type: 'string', example: '18:00' },
                active:       { type: 'boolean', default: true },
                city:         { type: 'integer', description: 'ID de la ciudad', example: 1 },
            },
        },
        City: {
            type: 'object',
            properties: {
                idCity:    { type: 'integer', example: 1 },
                nameCity:  { type: 'string', example: 'Rosario' },
                active:    { type: 'boolean' },
                province:  { type: 'object', description: 'Provincia asociada' },
                offices:   { type: 'array', items: { type: 'object' } },
            },
            },
            CityInput: {
            type: 'object',
            required: ['nameCity', 'active', 'province'],
            properties: {
                nameCity:  { type: 'string', example: 'Rosario' },
                active:    { type: 'boolean', default: true },
                province:  { type: 'integer', description: 'ID de la provincia', example: 1 },
            },
        },
        Schedule: {
            type: 'object',
            properties: {
                day:         { type: 'string', example: 'lunes' },
                initialHour: { type: 'string', example: '08:00' },
                finalHour:   { type: 'string', example: '09:00' },
                duration:    { type: 'integer', example: 30 },
                person:      { type: 'object', description: 'Profesional asociado' },
                room:        { type: 'object', description: 'Consultorio asociado' },
            },
            },
            ScheduleInput: {
            type: 'object',
            required: ['day', 'initialHour', 'finalHour', 'duration', 'person', 'room'],
            properties: {
                day:         { type: 'string', example: 'lunes' },
                initialHour: { type: 'string', example: '08:00' },
                finalHour:   { type: 'string', example: '09:00' },
                duration:    { type: 'integer', example: 30 },
                person:      { type: 'string', description: 'Email del profesional', example: 'doctor@mail.com' },
                room:        { type: 'integer', description: 'ID del consultorio', example: 1 },
            },
        },
        Appointment: {
            type: 'object',
            properties: {
                numAppointment: { type: 'integer', example: 1 },
                date:           { type: 'string', format: 'date', example: '2026-03-15' },
                initialHour:    { type: 'string', example: '09:00' },
                finalHour:      { type: 'string', example: '09:30' },
                value:          { type: 'number', example: 1500 },
                state:          { type: 'string', description: 'pending | accepted | assisted, o un ISO timestamp si fue cancelado', example: 'pending' },
                observations:   { type: 'string', nullable: true, example: 'Paciente con fiebre alta' },
                reminderSent:   { type: 'string', enum: ['not sent', 'sent'] },
                professional:   { type: 'object', description: 'Profesional asociado' },
                patient:        { type: 'object', nullable: true, description: 'Paciente asociado (uno solo por turno)' },
                room:           { type: 'object', description: 'Consultorio asociado' },
            },
            },
            AppointmentInput: {
            type: 'object',
            required: ['date', 'initialHour', 'finalHour', 'professional', 'room'],
            properties: {
                date:         { type: 'string', format: 'date', example: '2026-03-15' },
                initialHour:  { type: 'string', example: '09:00' },
                finalHour:    { type: 'string', example: '09:30' },
                value:        { type: 'number', example: 1500 },
                professional: { type: 'string', description: 'Email del profesional', example: 'doctor@mail.com' },
                patientEmail: { type: 'string', description: 'Email del paciente', example: 'paciente@mail.com' },
                room:         { type: 'integer', description: 'ID del consultorio', example: 1 },
            },
        },
        Diagnostic: {
            type: 'object',
            description: 'Parte clínica de un turno. Ya no es una entidad propia: se deriva del turno.',
            properties: {
                appointment:  { type: 'integer', description: 'Número del turno', example: 1 },
                patient:      { type: 'string', description: 'Email del paciente', example: 'paciente@mail.com' },
                state:        { type: 'string', description: 'Estado del turno', example: 'assisted' },
                observations: { type: 'string', example: 'Paciente con fiebre alta', nullable: true },
            },
            },
            DiagnosticInput: {
            type: 'object',
            properties: {
                patientEmail: { type: 'string', description: 'Email del paciente del turno', example: 'paciente@mail.com' },
                state:        { type: 'string', enum: ['pending', 'accepted', 'assisted'], example: 'assisted' },
                observations: { type: 'string', example: 'Paciente con fiebre alta' },
            },
        },
      },
    },
  },
  apis: ['./src/people/people.routes.ts', './src/rooms/rooms.routes.ts',
     './src/provinces/provinces.routes.ts', './src/offices/offices.routes.ts' ,
      './src/cities/cities.routes.ts', './src/schedule/schedule.routes.ts', 
      './src/appointments/appointments.routes.ts'],
};

const spec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}