import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

class AuthController {
  
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const admin = await prisma.admin.findUnique({
        where: { username },
      });

      if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username, email: admin.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, expiresIn: 86400 });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  logout(req: Request, res: Response) {
    // Stateles logic implies we just tell the client to discard the token.
    // In valid implementation we might blacklist the token, but for v1 simplified:
    res.json({ message: 'Logged out successfully' });
  }

  async me(req: any, res: Response) {
    // req.user is populated by middleware
    res.json({ user: req.user });
  }
}

export const authController = new AuthController();
