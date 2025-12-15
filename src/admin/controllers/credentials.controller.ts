import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma';

class CredentialsController {
  
  // GET /api/admin/credentials
  async listCredentials(req: Request, res: Response) {
    try {
      const credentials = await prisma.serviceAccount.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          fileName: true
        }
      });

      const mapped = credentials.map(cred => ({
        id: cred.id,
        name: cred.fileName || cred.name, // Display filename if available, else name
        path: `db://${cred.email || cred.name}` // Virtual path for UI reference
      }));

      res.json(mapped);
    } catch (error) {
      console.error('List Credentials error:', error);
      res.status(500).json({ message: 'Error listing credentials' });
    }
  }
}

export const credentialsController = new CredentialsController();
