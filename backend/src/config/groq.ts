import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

export const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const GROQ_CONFIG = {
    model: "llama-3.3-70b-versatile", 
    temperature: 0.7, // creatividad de la respuesta
    max_tokens: 800, // cantidad de tokens en la respuesta
}
