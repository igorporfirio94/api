
import express from 'express';
import bodyParser from 'body-parser';
import { sendMessageToChatwoot, initiateChatwootConversation } from '../services/chatwoot.service.js';
import { config } from './config.js';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

let contacts = {};

// Endpoint para validar o token de verificação do Webhook da Meta
app.get('/webhook', (req, res) => {
  const verifyToken = config.META_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Endpoint para processar as notificações do Webhook da Meta
app.post('/webhook', (req, res) => {
  const data = req.body;

  console.log(`Webhook received data: ${JSON.stringify(data)}`);

  if (data.object === 'whatsapp_business_account') {
    data.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'messages') {
          const messages = change.value.messages;
          if (messages && messages.length > 0) {
            handleMessageFromMeta(change.value);
          }
        }
      });
    });
  }

  res.sendStatus(200);
});

// Endpoint para processar os webhooks do Chatwoot
app.post('/chatwoot-webhook', async (req, res) => {
  const data = req.body;
  console.log(`Webhook received data: ${JSON.stringify(data)}`);

  if (data.event === 'message_created' && data.message.message_type === 'incoming') {
    await handleMessageFromChatwoot(data.message);
  }

  res.status(200).json({ status: 'success' });
});

// Endpoint para enviar mensagens para o WhatsApp
app.post('/send_message', async (req, res) => {
  try {
    const { recipient_id, message } = req.body;
    console.log(`Received data: ${JSON.stringify(req.body)}`);

    if (!recipient_id || !message) {
      console.error('recipient_id and message are required');
      return res.status(400).json({ error: 'recipient_id and message are required' });
    }

    const headers = {
      Authorization: `Bearer ${config.META_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
    const payload = {
      messaging_product: 'whatsapp',
      to: recipient_id,
      type: 'text',
      text: { body: message },
    };

    console.log(`Sending payload: ${JSON.stringify(payload)} to ${config.META_API_URL}`);
    const response = await axios.post(config.META_API_URL, payload, { headers });
    console.log(`Received response: ${JSON.stringify(response.data)}`);

    await sendMessageToChatwoot(recipient_id, message);

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para iniciar uma conversa no Chatwoot
app.post('/initiate_conversation', async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    console.log(`Received data: ${JSON.stringify(req.body)}`);

    if (!phone_number || !message) {
      console.error('phone_number and message are required');
      return res.status(400).json({ error: 'phone_number and message are required' });
    }

    const response = await initiateChatwootConversation(phone_number, message);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Função para lidar com mensagens recebidas do Chatwoot
const handleMessageFromChatwoot = async (message) => {
  console.log(`Handling message from Chatwoot: ${JSON.stringify(message)}`);

  const phoneNumber = message.sender.phone_number;
  const responseMessage = 'Obrigado pela sua mensagem!'; // Resposta automática

  try {
    const response = await sendMessageToWhatsapp(phoneNumber, responseMessage);
    console.log(`Message sent to WhatsApp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Função para lidar com mensagens recebidas da Meta
const handleMessageFromMeta = async (value) => {
  const message = value.messages[0];
  const contact = value.contacts[0];
  console.log(`Handling message from Meta: ${JSON.stringify(message)}`);

  const phoneNumber = message.from;
  const messageText = message.text.body;
  const contactName = contact.profile.name;
  const responseMessage = 'Obrigado pela sua mensagem!'; // Resposta automática

  console.log(`Contact Name: ${contactName}, Phone Number: ${phoneNumber}`);

  // Armazena os dados do contato
  contacts[phoneNumber] = {
    name: contactName,
    phone: phoneNumber,
  };

  try {
    // Enviar resposta automática para o WhatsApp
    await sendMessageToWhatsapp(phoneNumber, responseMessage);

    // Enviar mensagem recebida para o Chatwoot
    await sendMessageToChatwoot(phoneNumber, messageText);
  } catch (error) {
    console.error('Error handling message from Meta:', error);
  }
};

// Função para enviar mensagens para o WhatsApp
const sendMessageToWhatsapp = async (phoneNumber, message) => {
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'text',
    text: { body: message },
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.META_API_TOKEN}`,
  };

  return axios.post(config.META_API_URL, payload, { headers });
};

// Endpoint para obter os contatos armazenados
app.get('/contacts', (req, res) => {
  res.status(200).json(contacts);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});