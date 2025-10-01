import { Router } from "express";

export const appointmentRouter = Router();

// Define appointment-related routes here
appointmentRouter.get("/", (req, res) => {
  res.send("List of appointments");
});