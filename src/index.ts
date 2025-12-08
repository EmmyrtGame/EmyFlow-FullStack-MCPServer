import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { clients } from './config/clients';

dotenv.config();

import webhookRoutes from './routes/webhooks';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('MCP Server is running');
});

app.use('/webhooks', webhookRoutes);

// --- MCP SSE Transport Setup ---
// Store active transports by sessionId
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  console.log('New SSE connection attempt');
  
  const server = createMcpServer();
  const transport = new SSEServerTransport('/messages', res);
  
  // Connect the server to the transport
  await server.connect(transport);
  
  // The transport should now have a sessionId (accessible via private property or helper if SDK exposes it, 
  // but for SSEServerTransport from SDK, it typically generates one just before sending the endpoint event).
  // Ideally, we can access it. However, the standard SDK SSEServerTransport implementation 
  // exposes it via the URL logic. 
  // NOTE: In the official SDK, handlePostMessage expects to route to THIS transport.
  // We need to capture the sessionId to route standard POST requests.
  // The SDK's SSEServerTransport.sessionId is valid after start().
  
  const sessionId = (transport as any).sessionId;
  if (sessionId) {
    transports.set(sessionId, transport);
    console.log(`SSE Session created: ${sessionId}`);
  }

  // Cleanup on connection close
  res.on('close', () => {
    console.log(`SSE connection closed for session: ${sessionId}`);
    if (sessionId) {
      transports.delete(sessionId);
    }
  });
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).send('Missing sessionId parameter');
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Session not found or expired');
    return;
  }

  await transport.handlePostMessage(req, res);
});
// -------------------------------

const startServer = async () => {
  try {
    // await startMcpServer(); // Removed: server is now created per connection
    console.log('MCP Server started');

    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
