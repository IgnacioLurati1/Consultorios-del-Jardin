
import 'reflect-metadata'
import express from 'express'
import { provinceRouter } from './provinces/provinces.routes.js'
import { cityRouter} from './cities/cities.routes.js'
import { personRouter } from './people/people.routes.js'
import { officeRouter } from './offices/offices.routes.js'
import { roomRouter } from './rooms/rooms.routes.js'
import { orm, syncSchema } from './shared/db/orm.js'
import { RequestContext } from '@mikro-orm/core'
import admin from "./config/firebase.js";

import { Request, Response, NextFunction } from "express";

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido" });
  }
}


const app = express()
app.use(express.json())

app.use((req, res, next) => {
  RequestContext.create(orm.em, next)
})

app.use('/api/provinces', verifyToken, provinceRouter)
app.use('/api/cities', cityRouter)
app.use('/api/people', personRouter)
app.use('/api/offices', officeRouter)
app.use('/api/rooms', roomRouter)

app.use((_, res) => {
  return res.status(404).send({ message: 'Resource not found' })
})

await syncSchema(); //Never in production

app.listen(3000, () => {
  console.log('Server runnning on http://localhost:3000/')
})