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
  addProfessional,
  remove,
  toggleState,
  changePassword,
  sendPasswordMail,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive,
  checkEmailAvailability
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
 *     summary: Eliminar persona
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
 *         description: Solicitud procesada
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
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