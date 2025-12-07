import axios from 'axios';
import { clients } from '../config/clients';

export const addLabelToChat = async (args: { client_id: string; phone_number: string; labels: string[] }) => {
  const { client_id, phone_number, labels } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  try {
    const deviceId = clientConfig.wassenger.deviceId;
    const chatWid = phone_number.includes('@c.us') ? phone_number : `${phone_number}@c.us`;

    const response = await axios.patch(
      `https://api.wassenger.com/v1/chat/${deviceId}/chats/${chatWid}/labels?upsert=true`, 
      labels,
      {
        headers: {
          "Token": clientConfig.wassenger.apiKey
        }
      }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error(`Error adding labels [${labels}] to ${phone_number}:`, error.response?.data || error.message);
    // Don't throw for internal label ops, just return failure
    return { success: false, error: error.message };
  }
};

export const updateContactMetadata = async (args: { client_id: string; phone_number: string; metadata: Record<string, string> }) => {
  const { client_id, phone_number, metadata } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  try {
    const deviceId = clientConfig.wassenger.deviceId;
    const chatWid = phone_number.includes('@c.us') ? phone_number : `${phone_number}@c.us`;

    // Assuming endpoint format based on typical Wassenger usage for contact updates
    // PATCH /v1/chat/{deviceId}/contacts/{wid}
    // Body: { metadata: [ { key: 'k', value: 'v' } ] } or { metadata: { k: v } }?
    // User shared payload showing metadata as an array of objects: [{key: '...', value: '...'}]
    // We should send it in that format.
    
    const formattedMetadata = Object.entries(metadata).map(([key, value]) => ({ key, value }));

    const response = await axios.patch(
      `https://api.wassenger.com/v1/chat/${deviceId}/contacts/${chatWid}`, 
      {
        metadata: formattedMetadata
      },
      {
        headers: {
          "Token": clientConfig.wassenger.apiKey
        }
      }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error(`Error updating metadata for ${phone_number}:`, error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

export const crmHandoffHuman = async (args: { client_id: string; phone_number: string }) => {
  const result = await addLabelToChat({
    client_id: args.client_id,
    phone_number: args.phone_number,
    labels: ["humano"]
  });

  if (!result.success) {
     throw new Error(`Failed to handoff to human: ${result.error}`);
  }

  return { content: [{ type: "text", text: JSON.stringify({ success: true, data: result.data }) }] };
};
