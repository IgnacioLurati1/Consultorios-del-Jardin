import { Router } from "express";
import {
  sanitizePersonInput,
  findAll,
  findOne,
  add,
  update,
  loginWithEmailAndPassword,
  logOut,
  remove,
  toggleState,
  changePassword,
  sendPasswordMail,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive
} from "./people.controller.js";
import { verifyToken, verifyAdmin } from "../config/middlewares.js";

export const personRouter = Router();

/**
 * @swagger
 * /people:
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
 * /people/NoAdmin:
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
 * /people/type/{peopleType}:
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
 * /people/type/active/{peopleType}:
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
 * /people/professionals/office/{officeId}/{speciality}:
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
 * /people/{email}:
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
 * /people:
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
personRouter.post("/", sanitizePersonInput, add);

/**
 * @swagger
 * /people/login:
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
personRouter.post("/login", sanitizePersonInput, loginWithEmailAndPassword);

/**
 * @swagger
 * /people/logout:
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
 * /people/changePassword:
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
personRouter.patch("/changePassword", sanitizePersonInput, changePassword);

/**
 * @swagger
 * /people/{email}:
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
 * /people/{email}:
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
 * /people/{email}/toggleState:
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
 * /people/{email}/passwordMail:
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
personRouter.post("/:email/passwordMail", sendPasswordMail);