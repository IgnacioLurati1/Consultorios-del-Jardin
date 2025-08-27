import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

interface RequestWithUser extends Request {
    user?: any;
}

export async function verifyToken(req: RequestWithUser, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1]; //Del header, nos quedamos con el authorization: Bearer, el ? pregunta si existe, de lo contrario undefined y el split separa el bearer del token y nos quedamos con este ultimo
    if (!token) return res.status(401).send('Unauthorized');

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET as jwt.Secret);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).send('Token inválido');
    }
}