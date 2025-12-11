import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ConfigSchema, ClientConfigInput } from '../utils/validators.util';
import { encrypt, decrypt } from '../utils/crypto.util';

const prisma = new PrismaClient();

class ClientsController {
  
  // GET /api/admin/clients
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
          { name: { contains: search } },
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

  // GET /api/admin/clients/:id
  async getClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const client = await prisma.client.findUnique({
        where: { id }
      });

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Decrypt sensitive tokens for display if necessary
      
      const clientData = client as any;
      // if (clientData.meta?.accessToken) clientData.meta.accessToken = decrypt(clientData.meta.accessToken);
      // if (clientData.wassenger?.apiKey) clientData.wassenger.apiKey = decrypt(clientData.wassenger.apiKey);
 
      res.json(clientData);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching client' });
    }
  }

  // POST /api/admin/clients
  async createClient(req: Request, res: Response) {
    try {
      // Validate input
      const validation = ConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
         return res.status(400).json({ errors: validation.error.format() });
      }

      const data = validation.data;

      // Check unique slug
      const existing = await prisma.client.findUnique({ where: { slug: data.slug } });
      if (existing) {
        return res.status(400).json({ message: 'Slug already in use' });
      }
      
      // Encrypt sensitive fields
      // NOTE: We'll modify the data object before saving
      const dataToSave = { ...data } as any;
      
      delete dataToSave.google;

      if (dataToSave.meta?.accessToken) {
        dataToSave.meta.accessToken = encrypt(dataToSave.meta.accessToken);
      }
      if (dataToSave.wassenger?.apiKey) {
        dataToSave.wassenger.apiKey = encrypt(dataToSave.wassenger.apiKey);
      }


      const client = await prisma.client.create({
        data: dataToSave
      });

      res.status(201).json(client);

    } catch (error) {
      console.error('Create Client error:', error);
      res.status(500).json({ message: 'Error creating client' });
    }
  }

  // PUT /api/admin/clients/:id
  async updateClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = ConfigSchema.partial().safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.format() });
      }

      const data = validation.data as any;

      // If updating slug, check uniqueness
      if (data.slug) {
        const existing = await prisma.client.findUnique({ where: { slug: data.slug } });
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: 'Slug already in use' });
        }
      }

      // Encrypt sensitive fields if they are being updated
      if (data.meta?.accessToken) {
        data.meta.accessToken = encrypt(data.meta.accessToken);
      }
      if (data.wassenger?.apiKey) {
        data.wassenger.apiKey = encrypt(data.wassenger.apiKey);
      }


      // Retrieve existing client for merging JSON fields
      const existingClient = await prisma.client.findUnique({ where: { id } });
      if (!existingClient) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Merge JSON fields manually as Prisma replaces them
      const updatedData = { ...data };
      
      delete updatedData.google;

      if (data.meta) {
        updatedData.meta = { ...(existingClient.meta as object || {}), ...data.meta };
      }
      if (data.wassenger) {
        updatedData.wassenger = { ...(existingClient.wassenger as object || {}), ...data.wassenger };
      }
      if (data.reminderTemplates) {
        updatedData.reminderTemplates = { ...(existingClient.reminderTemplates as object || {}), ...data.reminderTemplates };
      }

      const client = await prisma.client.update({
        where: { id },
        data: updatedData
      });
      
      res.json(client);

    } catch (error) {
      console.error('Update Client error:', error);
      res.status(500).json({ message: 'Error updating client' });
    }
  }

  // DELETE /api/admin/clients/:id
  async deleteClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Soft delete
      await prisma.client.update({
        where: { id },
        data: { isActive: false }
      });

      res.status(204).send();

    } catch (error) {
      res.status(500).json({ message: 'Error deleting client' });
    }
  }
}

export const clientsController = new ClientsController();
