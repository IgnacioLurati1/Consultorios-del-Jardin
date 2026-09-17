import { Router } from "express";
import {
  sanitizePersonInput,
  findAll,
  findOne,
  add,
  update,
  loginWithEmailAndPassword,
  logOut,
  addAnonymousPatient,
  removeAnonymousPatient,
  addProfessional,
  remove,
  toggleState,
  toggleBookable,
  toggleWaitlist,
  changePassword,
  checkWelcomeLink,
  professionalPasswords,
  sendAdminPasswordMails,
  setFirstPassword,
  sendPasswordMail,
  requestSignup,
  confirmSignup,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive,
  checkEmailAvailability,
  bouncedEmails,
  changePatientEmail
} from "./people.controller.js";
import { verifyToken, verifyAdmin } from "../config/middlewares.js";
import { authLimiter, lookupLimiter } from "../config/rateLimiter.js";

export const personRouter = Router();

/**
 * @swagger
 * /api/people:
 *   get:
 *     summary: Obtener todas las personas
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de personas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
personRouter.get("/", verifyToken, verifyAdmin, findAll);

/**
 * @swagger
 * /api/people/NoAdmin:
 *   get:
 *     summary: Obtener todas las personas que no son admin
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de personas no admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
personRouter.get("/NoAdmin", verifyToken, verifyAdmin, findAllNoAdmin);

/**
 * @swagger
 * /api/people/type/{peopleType}:
 *   get:
 *     summary: Obtener personas por tipo
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: peopleType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [client, professional, admin]
 *     responses:
 *       200:
 *         description: Lista de personas del tipo indicado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
personRouter.get("/type/:peopleType", verifyToken, verifyAdmin, findAllPerType);

/**
 * @swagger
 * /api/people/type/active/{peopleType}:
 *   get:
 *     summary: Obtener personas activas por tipo
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: peopleType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [client, professional, admin]
 *     responses:
 *       200:
 *         description: Lista de personas activas del tipo indicado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       500:
 *         description: Error del servidor
 */
personRouter.get("/type/active/:peopleType", verifyToken, findAllPerTypeActive);

/**
 * @swagger
 * /api/people/professionals/office/{officeId}/{speciality}:
 *   get:
 *     summary: Obtener profesionales por consultorio y especialidad
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: officeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del consultorio
 *       - in: path
 *         name: speciality
 *         required: false
 *         schema:
 *           type: string
 *         description: Especialidad del profesional (opcional)
 *     responses:
 *       200:
 *         description: Lista de profesionales encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       500:
 *         description: Error del servidor
 */
personRouter.get("/professionals/office/:officeId/:speciality?", verifyToken, findProfesionalByOffice);

/**
 * @swagger
 * /api/people/available/{email}:
 *   get:
 *     summary: Saber si un email está libre para registrarse
 *     description: Público. Un paciente anónimo no ocupa el email; registrarse con él lo convierte en cuenta real.
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado de la consulta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available: { type: boolean }
 *       429:
 *         description: Demasiadas consultas
 */
personRouter.get("/available/:email", lookupLimiter, checkEmailAvailability);

/**
 * @swagger
 * /api/people/bounced:
 *   get:
 *     summary: Las direcciones de correo que rebotaron
 *     description: >
 *       Las que el proveedor de correo dejó de usar porque la casilla no existe. Sirven
 *       para marcar en pantalla a la persona que no está recibiendo nada.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de direcciones
 *       403:
 *         description: Acceso denegado
 */
personRouter.get("/bounced", verifyToken, bouncedEmails);

/**
 * @swagger
 * /api/people/{email}:
 *   get:
 *     summary: Obtener persona por email
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email de la persona
 *     responses:
 *       200:
 *         description: Persona encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       500:
 *         description: Error interno
 */
personRouter.get("/:email", verifyToken, findOne);

/**
 * @swagger
 * /api/people:
 *   post:
 *     summary: Registrar nueva persona
 *     tags: [People]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       201:
 *         description: Persona creada con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *                 token: { type: string }
 *       403:
 *         description: Tipo de persona inválido
 *       409:
 *         description: La persona ya existe
 *       500:
 *         description: Error del servidor
 */
personRouter.post("/", authLimiter, sanitizePersonInput, add);

/**
 * @swagger
 * /api/people/signup:
 *   post:
 *     summary: Mandar el mail que crea la cuenta de un paciente
 *     description: >
 *       No crea nada. Valida los datos y manda un link que vence en 30 minutos, con los
 *       datos firmados adentro. Contesta lo mismo aunque el email ya tenga cuenta.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       200:
 *         description: Mail mandado
 *       400:
 *         description: Los datos no son válidos
 *       500:
 *         description: Error del servidor
 */
personRouter.post("/signup", authLimiter, sanitizePersonInput, requestSignup);

/**
 * @swagger
 * /api/people/signup/confirm:
 *   post:
 *     summary: Crear la cuenta con el token del mail
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *     responses:
 *       201:
 *         description: Cuenta creada, con la sesión abierta
 *       400:
 *         description: Falta el token
 *       401:
 *         description: El link venció
 *       409:
 *         description: Ya hay una cuenta con ese email
 */
personRouter.post("/signup/confirm", authLimiter, confirmSignup);

/**
 * @swagger
 * /api/people/login:
 *   post:
 *     summary: Login con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@mail.com
 *               password:
 *                 type: string
 *                 example: miPassword123
 *     responses:
 *       200:
 *         description: Login exitoso, retorna JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 token: { type: string }
 *       401:
 *         description: Credenciales inválidas
 *       500:
 *         description: Error del servidor
 */
personRouter.post("/login",authLimiter, sanitizePersonInput, loginWithEmailAndPassword);

/**
 * @swagger
 * /api/people/logout:
 *   post:
 *     summary: Cerrar sesión (limpia el refreshToken cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *       500:
 *         description: Error del servidor
 */
personRouter.post("/logout", logOut);

/**
 * @swagger
 * /api/people/anonymous:
 *   post:
 *     summary: Crear un paciente anónimo (sin cuenta). Solo profesionales
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, surname]
 *             properties:
 *               email:       { type: string, example: paciente@mail.com }
 *               name:        { type: string, example: Marta }
 *               surname:     { type: string, example: Gómez }
 *               docType:     { type: string, example: DNI }
 *               docNumber:   { type: string, example: '30999999' }
 *               phoneNumber: { type: string, example: '3419999999' }
 *     responses:
 *       201:
 *         description: Paciente anónimo creado
 *       403:
 *         description: Solo un profesional puede cargar pacientes anónimos
 *       409:
 *         description: Ya existe una persona con ese email
 */
personRouter.post("/anonymous", verifyToken, sanitizePersonInput, addAnonymousPatient);

/**
 * @swagger
 * /api/people/anonymous/{email}:
 *   delete:
 *     summary: Deshacer el alta de un paciente anónimo. Solo el profesional que lo cargó, y solo si no tiene turnos
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paciente borrado
 *       403:
 *         description: No es un paciente sin cuenta, o lo cargó otro profesional
 *       404:
 *         description: No existe esa persona
 *       409:
 *         description: El paciente ya tiene turnos
 */
personRouter.delete("/anonymous/:email", verifyToken, removeAnonymousPatient);

/**
 * @swagger
 * /api/people/{email}/email:
 *   patch:
 *     summary: Corregir el correo de un paciente sin cuenta
 *     description: >
 *       El correo es la clave de la persona en la base, así que se crea la ficha con la
 *       dirección nueva, se le lleva todo lo que tenía la vieja (turnos, recurrencias,
 *       lista de espera, avisos) y se borra la vieja. Lo puede hacer la administración y
 *       el profesional que cargó a esa persona.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Correo corregido
 *       400:
 *         description: El correo nuevo no sirve
 *       403:
 *         description: No lo cargó este profesional, o la persona tiene cuenta propia
 *       409:
 *         description: Ya hay una persona con ese correo
 */
personRouter.patch("/:email/email", verifyToken, sanitizePersonInput, changePatientEmail);

/**
 * @swagger
 * /api/people/professional:
 *   post:
 *     summary: Registrar un profesional. Solo admin, no devuelve token
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       201:
 *         description: Profesional registrado
 *       403:
 *         description: Acceso denegado
 *       409:
 *         description: Ya existe una cuenta con ese email
 */
personRouter.post("/professional", verifyToken, verifyAdmin, sanitizePersonInput, addProfessional);

/**
 * @swagger
 * /api/people/changePassword:
 *   patch:
 *     summary: Cambiar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 example: nuevaPassword123
 *     responses:
 *       200:
 *         description: Contraseña cambiada con éxito
 *       500:
 *         description: Error del servidor
 */
personRouter.patch("/changePassword",authLimiter, sanitizePersonInput, changePassword);

/**
 * @swagger
 * /api/people/welcome/check:
 *   post:
 *     summary: Ver si el link de bienvenida del profesional sirve
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: El link sirve
 *       401:
 *         description: El link venció
 *       409:
 *         description: El link ya se usó
 */
personRouter.post("/welcome/check", authLimiter, checkWelcomeLink);

/**
 * @swagger
 * /api/people/welcome:
 *   post:
 *     summary: Crear la contraseña del primer ingreso. Deja la sesión abierta
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña creada
 *       401:
 *         description: El link venció
 *       409:
 *         description: El link ya se usó
 */
personRouter.post("/welcome", authLimiter, setFirstPassword);

/**
 * @swagger
 * /api/people/passwords/professionals:
 *   get:
 *     summary: Profesionales habilitados con su último cambio de contraseña
 *     description: >
 *       Para saber quién sigue con la contraseña provisoria. Trae el último cambio de
 *       contraseña, null si no hay registro.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: La lista
 *       403:
 *         description: Solo para administradores
 */
// Dos tramos a propósito: con uno solo lo agarraría antes GET /:email, que está más arriba.
personRouter.get("/passwords/professionals", verifyToken, verifyAdmin, professionalPasswords);

/**
 * @swagger
 * /api/people/passwords/mail:
 *   post:
 *     summary: Manda el mail para cambiar la contraseña, enviado por la administración
 *     description: >
 *       El mismo mail de recuperar contraseña, aclarando que lo envió la administración.
 *       El link vale seis meses y sirve una sola vez. Devuelve a quiénes salió, a quiénes
 *       no se pudo mandar y cuántos se saltearon por no ser profesionales habilitados.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emails]
 *             properties:
 *               emails:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Resultado del envío
 *       400:
 *         description: No se eligió a nadie
 *       403:
 *         description: Solo para administradores
 */
personRouter.post("/passwords/mail", verifyToken, verifyAdmin, sendAdminPasswordMails);

// Los nombres con los que salió la primera versión de la pantalla. Quedan mientras la
// página y el servidor se publican por separado, para que la ventana vieja no se rompa.
personRouter.get("/welcome/pending", verifyToken, verifyAdmin, professionalPasswords);
personRouter.post("/welcome/resend", verifyToken, verifyAdmin, sendAdminPasswordMails);

/**
 * @swagger
 * /api/people/{email}:
 *   put:
 *     summary: Actualizar persona
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       200:
 *         description: Persona actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       409:
 *         description: La persona ya existe
 *       500:
 *         description: Error del servidor
 *   patch:
 *     summary: Actualizar persona parcialmente
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       200:
 *         description: Persona actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       500:
 *         description: Error del servidor
 */
personRouter.put("/:email", verifyToken, sanitizePersonInput, update);
personRouter.patch("/:email", verifyToken, sanitizePersonInput, update);

/**
 * @swagger
 * /api/people/{email}:
 *   delete:
 *     summary: Eliminar un paciente sin turnos (solo admin)
 *     description: >
 *       Borra a la persona y todo lo que cuelga de ella. Solo para un paciente que no
 *       tenga ningún turno cargado. Las demás cuentas se deshabilitan, y las borra la
 *       limpieza de fin de mes cuando llevan tres semanas afuera.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paciente eliminado
 *       403:
 *         description: No es un paciente
 *       404:
 *         description: No existe esa persona
 *       409:
 *         description: El paciente ya tiene turnos cargados
 *       500:
 *         description: Error del servidor
 */
personRouter.delete("/:email", verifyToken, verifyAdmin, sanitizePersonInput, remove);

/**
 * @swagger
 * /api/people/{email}/toggleState:
 *   patch:
 *     summary: Cambiar estado activo/inactivo de una persona
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado cambiado con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error interno
 */
personRouter.patch("/:email/toggleState", verifyToken, verifyAdmin, sanitizePersonInput, toggleState);

/**
 * @swagger
 * /api/people/{email}/toggleBookable:
 *   patch:
 *     summary: Mostrar o esconder a un profesional en la búsqueda de turnos (solo admin)
 *     description: >
 *       No lo deshabilita: sigue entrando, viendo su agenda y cargando turnos a mano. Lo
 *       único que cambia es si se ofrece cuando un paciente busca con quién atenderse.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cambiado con éxito
 *       400:
 *         description: Esa persona no es un profesional
 *       403:
 *         description: Acceso denegado
 */
personRouter.patch("/:email/toggleBookable", verifyToken, verifyAdmin, sanitizePersonInput, toggleBookable);

/**
 * @swagger
 * /api/people/{email}/toggleWaitlist:
 *   patch:
 *     summary: Prender o apagar la lista de espera de un profesional (solo admin)
 *     description: >
 *       Apagarla vacía la lista y les avisa a los que estaban. Con la lista apagada, el
 *       paciente que toca el botón ve que ese profesional no trabaja con lista de espera.
 *     tags: [People]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cambiado con éxito
 *       400:
 *         description: Esa persona no es un profesional
 */
personRouter.patch("/:email/toggleWaitlist", verifyToken, verifyAdmin, sanitizePersonInput, toggleWaitlist);

/**
 * @swagger
 * /api/people/{email}/passwordMail:
 *   post:
 *     summary: Enviar mail para recuperación de contraseña
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mail enviado
 *       500:
 *         description: Error al enviar el mail
 */
personRouter.post("/:email/passwordMail",authLimiter, sendPasswordMail);