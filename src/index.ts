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
  
  // 1. Set headers manually to ensure correct SSE setup and anti-buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For Nginx/Hostinger
  
  if (res.flushHeaders) res.flushHeaders();

  // 2. Send padding to bypass buffering (some proxies need 2KB+ to start streaming)
  const padding = ': ' + ' '.repeat(2048) + '\n\n';
  res.write(padding);

  // 3. Construct Absolute URL for the endpoint
  // Use https by default for production, or req.protocol if trusted
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const endpointUrl = `${protocol}://${host}/messages`;

  console.log(`Setting up transport with endpoint: ${endpointUrl}`);

  const server = createMcpServer();
  const transport = new SSEServerTransport(endpointUrl, res);
  
  // Connect the server to the transport
  await server.connect(transport);
  
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
