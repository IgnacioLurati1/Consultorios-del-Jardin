import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface AuthRequest extends Request {
  cookies: {
    refreshToken?: string;
  };
}

export default function refreshToken(req: AuthRequest, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Token inexistente" });
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET as jwt.Secret, (err, decoded: any) => {
    if (err) return res.status(403).json({ message: "Refresh token inválido" });

    const token = jwt.sign({ email: decoded.email, type: decoded.type }, process.env.JWT_SECRET as jwt.Secret, { expiresIn: "15m" });

    return res.json({ token: token });
  });
}
