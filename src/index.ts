import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { startMcpServer } from './mcp/server';
import { clients } from './config/clients';

dotenv.config();

import webhookRoutes from './routes/webhooks';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.send('MCP Server is running');
});

// Webhook routes
app.use('/webhooks', webhookRoutes);

const startServer = async () => {
  try {
    // Start MCP Server
    await startMcpServer();
    console.log('MCP Server started');

    // Start Express Server
    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
