import axios from 'axios';
import { config } from '../api/config.js';

const CHATWOOT_URL = config.CHATWOOT_URL;
const CHATWOOT_API_TOKEN = config.CHATWOOT_API_TOKEN;

// Função para verificar se o contato já existe
const checkIfContactExists = async (formattedPhoneNumber) => {
  const contactsUrl = `${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/contacts`;
  const contactResponse = await axios.get(contactsUrl, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'api_access_token': CHATWOOT_API_TOKEN,
    },
    params: { inbox_id: config.CHATWOOT_INBOX_ID },
  });

  const contacts = contactResponse.data.payload || [];
  for (const contact of contacts) {
    if (contact.phone_number === formattedPhoneNumber) {
      return contact.id;
    }
  }
  return null;
};

// Função para criar contato se não existir
const createContactIfNotExists = async (contactPayload) => {
  const contactId = await checkIfContactExists(contactPayload.phone_number);
  if (contactId) {
    console.log('Contact already exists');
    return contactId;
  }

  try {
    const createContactResponse = await axios.post(`${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/contacts`, contactPayload, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'api_access_token': CHATWOOT_API_TOKEN,
      },
    });
    return createContactResponse.data.payload.contact.id;
  } catch (error) {
    console.error('Error creating contact:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Função para enviar mensagem ao Chatwoot
export const sendMessageToChatwoot = async (phoneNumber, messageContent) => {
  try {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'api_access_token': CHATWOOT_API_TOKEN,
    };

    // Formatar o número de telefone para o formato E.164 se necessário
    let formattedPhoneNumber = phoneNumber;
    if (!formattedPhoneNumber.startsWith('+')) {
      formattedPhoneNumber = `+${formattedPhoneNumber}`;
    }

    // Obter os dados do contato armazenados na aplicação
    const contact = contacts[phoneNumber];

    if (!contact) {
      throw new Error('Contact not found in stored contacts');
    }

    // Payload para criar contato
    const contactPayload = {
      inbox_id: config.CHATWOOT_INBOX_ID,
      name: contact.name,
      phone_number: formattedPhoneNumber,
      identifier: phoneNumber,
      custom_attributes: {
        type: 'customer',
      },
    };

    // Verifica se o contato já existe, caso contrário, cria um novo contato
    const contactId = await createContactIfNotExists(contactPayload);

    // Cria uma nova conversa
    const conversationUrl = `${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/conversations`;
    const conversationPayload = {
      inbox_id: config.CHATWOOT_INBOX_ID,
      contact_id: contactId,
    };

    let conversationId = null;
    try {
      const createConversationResponse = await axios.post(conversationUrl, conversationPayload, { headers });
      conversationId = createConversationResponse.data.id;
    } catch (createConversationError) {
      console.error('Error creating conversation:', createConversationError.response ? createConversationError.response.data : createConversationError.message);
      throw createConversationError;
    }

    // Envia a mensagem para a conversa
    const messageUrl = `${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;
    const messagePayload = {
      content: messageContent,
      message_type: 'outgoing',
      private: false,
    };

    try {
      const messageResponse = await axios.post(messageUrl, messagePayload, { headers });
      return messageResponse.data;
    } catch (messageError) {
      console.error('Error sending message:', messageError.response ? messageError.response.data : messageError.message);
      throw messageError;
    }
  } catch (error) {
    console.error('Error sending message to Chatwoot:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Função para iniciar uma conversa pelo Chatwoot
export const initiateChatwootConversation = async (phoneNumber, initialMessage) => {
  try {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'api_access_token': CHATWOOT_API_TOKEN,
    };

    // Formatar o número de telefone para o formato E.164 se necessário
    let formattedPhoneNumber = phoneNumber;
    if (!formattedPhoneNumber.startsWith('+')) {
      formattedPhoneNumber = `+${formattedPhoneNumber}`;
    }

    // Obter os dados do contato armazenados na aplicação
    const contact = contacts[phoneNumber];

    if (!contact) {
      throw new Error('Contact not found in stored contacts');
    }

    // Payload para criar contato
    const contactPayload = {
      inbox_id: config.CHATWOOT_INBOX_ID,
      name: contact.name,
      phone_number: formattedPhoneNumber,
      identifier: phoneNumber,
      custom_attributes: {
        type: 'customer',
      },
    };

    // Verifica se o contato já existe, caso contrário, cria um novo contato
    const contactId = await createContactIfNotExists(contactPayload);

    // Cria uma nova conversa
    const conversationUrl = `${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/conversations`;
    const conversationPayload = {
      inbox_id: config.CHATWOOT_INBOX_ID,
      contact_id: contactId,
      status: 'open',
    };

    let conversationId = null;
    try {
      const createConversationResponse = await axios.post(conversationUrl, conversationPayload, { headers });
      conversationId = createConversationResponse.data.id;
    } catch (createConversationError) {
      console.error('Error creating conversation:', createConversationError.response ? createConversationError.response.data : createConversationError.message);
      throw createConversationError;
    }

    // Envia a mensagem inicial para a conversa
    const messageUrl = `${CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;
    const messagePayload = {
      content: initialMessage,
      message_type: 'outgoing',
      private: false,
    };

    try {
      const messageResponse = await axios.post(messageUrl, messagePayload, { headers });
      return messageResponse.data;
    } catch (messageError) {
      console.error('Error sending message:', messageError.response ? messageError.response.data : messageError.message);
      throw messageError;
    }
  } catch (error) {
    console.error('Error initiating Chatwoot conversation:', error.response ? error.response.data : error.message);
    throw error;
  }
};
