import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ClientsController {
  
  async getClients(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search } }, // SQLite search is case-sensitive usually unless configured otherwise or using ltree? No, default contains. Prisma handles parameterization.
          { slug: { contains: search } }
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [clients, total] = await prisma.$transaction([
        prisma.client.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
            timezone: true,
            createdAt: true,
            // Don't modify or return sensitive config in list view usually, but requirements show basic fields in list response example.
            // Example response: id, slug, name, isActive, timezone, createdAt.
          }
        }),
        prisma.client.count({ where })
      ]);

      res.json({
        data: clients,
        meta: {
          total,
          page,
          limit
        }
      });

    } catch (error) {
      console.error('Get Clients error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

export const clientsController = new ClientsController();
