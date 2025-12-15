import { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { UserSchema } from '../utils/validators.util';
import bcrypt from 'bcrypt';

class UsersController {
  
  // GET /api/admin/users
  async listUsers(req: Request, res: Response) {
    try {
      const users = await prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true
          // Exclude password
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(users);
    } catch (error) {
       console.error("List Users Error", error);
       res.status(500).json({ message: "Error listing users" });
    }
  }

  // POST /api/admin/users
  async createUser(req: Request, res: Response) {
    try {
      const validation = UserSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.format() });
      }

      const { username, email, password } = validation.data;

      // Check existing
      const existing = await prisma.admin.findFirst({
        where: {
            OR: [
                { username },
                { email }
            ]
        }
      });

      if (existing) {
        return res.status(400).json({ message: "Username or Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.admin.create({
        data: {
            username,
            email,
            password: hashedPassword
        },
        select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
        }
      });

      res.status(201).json(user);

    } catch (error) {
      console.error("Create User Error", error);
      res.status(500).json({ message: "Error creating user" });
    }
  }

  // DELETE /api/admin/users/:id
  async deleteUser(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.admin.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Delete User Error", error);
        res.status(500).json({ message: "Error deleting user" });
    }
  }
}

export const usersController = new UsersController();
