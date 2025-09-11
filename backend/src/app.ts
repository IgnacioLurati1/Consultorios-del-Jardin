import "reflect-metadata";
import express from "express";
import { provinceRouter } from "./provinces/provinces.routes.js";
import { cityRouter } from "./cities/cities.routes.js";
import { personRouter } from "./people/people.routes.js";
import { officeRouter } from "./offices/offices.routes.js";
import { roomRouter } from "./rooms/rooms.routes.js";
import { orm, syncSchema } from "./shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";
import { verifyToken } from "./config/middlewares.js";
import { Request, Response } from "express";
import { scheduleRouter } from './schedule/schedule.routes.js'
import refreshToken from "./config/refreshToken.js";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

app.use("/api/provinces", verifyToken, provinceRouter);
app.use("/api/cities", verifyToken, cityRouter);
app.use("/api/people", personRouter);
app.use("/api/offices", verifyToken, officeRouter);
app.use("/api/rooms", verifyToken, roomRouter);
app.use('/api/schedules', scheduleRouter)
app.use("/api/tokenStatus", verifyToken, (req: Request, res: Response) => {
  res.status(200).json({ message: "Token válido" });
});
app.use("/api/refreshToken", refreshToken);

app.use((_, res) => {
  return res.status(404).send({ message: "Resource not found" });
});

await syncSchema(); //Never in production

app.listen(3000, () => {
  console.log("Server runnning on http://localhost:3000/");
});
