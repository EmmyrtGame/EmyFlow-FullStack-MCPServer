import axios from 'axios';
import { clients } from '../config/clients';

export const crmHandoffHuman = async (args: { client_id: string; phone_number: string }) => {
  const { client_id, phone_number } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  try {
    // Assuming Wassenger API for tagging
    // Note: This is a hypothetical endpoint based on requirements. 
    // Actual Wassenger API might differ.
    const response = await axios.post(
      `https://api.wassenger.com/v1/chat/labels`, 
      {
        phone: phone_number,
        labels: ["humano"]
      },
      {
        headers: {
          "Token": clientConfig.wassenger.apiKey
        }
      }
    );
    return { content: [{ type: "text", text: JSON.stringify({ success: true, data: response.data }) }] };
  } catch (error: any) {
    console.error('Error handing off to human:', error.response?.data || error.message);
    throw new Error(`Failed to handoff to human: ${error.message}`);
  }
};
