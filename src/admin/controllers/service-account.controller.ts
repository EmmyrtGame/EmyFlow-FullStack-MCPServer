import { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { encrypt } from '../utils/crypto.util';
import fs from 'fs';

class ServiceAccountController {
  
  // POST /api/admin/clients/:id/service-account
  async uploadServiceAccount(req: Request, res: Response) {
    try {
      const { id } = req.params; // Client ID
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      
      // Validation & Extraction
      let parsedCreds;
      try {
        parsedCreds = JSON.parse(fileContent);
        if (!parsedCreds.client_email) {
           throw new Error('Invalid Service Account JSON: missing client_email');
        }
      } catch (e) {
        // Cleanup temp upload
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Invalid JSON file or missing client_email' });
      }

      // Encrypt
      const encryptedContent = encrypt(fileContent);

      // Save to Global ServiceAccount Table
      const saName = parsedCreds.client_email;

      const serviceAccount = await prisma.serviceAccount.upsert({
        where: { name: saName },
        update: {
          encryptedContent,
          fileName: req.file.originalname,
          email: parsedCreds.client_email
        },
        create: {
          name: saName,
          email: parsedCreds.client_email,
          fileName: req.file.originalname,
          encryptedContent
        }
      });

      // Link to Client
      await prisma.client.update({
        where: { id },
        data: {
            serviceAccountId: serviceAccount.id
        }
      });

      // Cleanup temp upload file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      // Return response formatted for Frontend "path" input
      const virtualPath = `db://${serviceAccount.email}`;

      res.status(201).json({
        id: serviceAccount.id,
        fileName: serviceAccount.fileName,
        path: virtualPath, 
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
