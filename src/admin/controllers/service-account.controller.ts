import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../utils/crypto.util';
import fs from 'fs';

const prisma = new PrismaClient();

class ServiceAccountController {
  
  // POST /api/admin/clients/:id/service-account
  async uploadServiceAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      
      // Validation: basic JSON check
      try {
        JSON.parse(fileContent);
      } catch (e) {
        // Cleanup
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Invalid JSON file' });
      }

      // Encrypt
      const encryptedContent = encrypt(fileContent);

      // Save to DB
      const serviceAccount = await prisma.serviceAccount.upsert({
        where: {
          clientId_fileName: {
            clientId: id,
            fileName: req.file.originalname
          }
        },
        update: {
          encryptedContent
        },
        create: {
          clientId: id,
          fileName: req.file.originalname,
          encryptedContent
        }
      });

      // Cleanup temp file
      fs.unlinkSync(req.file.path);

      res.status(201).json({
        id: serviceAccount.id,
        fileName: serviceAccount.fileName,
        updatedAt: serviceAccount.updatedAt
      });

    } catch (error) {
      console.error('Upload Service Account error:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: 'Error uploading service account' });
    }
  }
}

export const serviceAccountController = new ServiceAccountController();
