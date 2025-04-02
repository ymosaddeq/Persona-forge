import axios from 'axios';

// Green API credentials
const idInstance = process.env.GREEN_API_INSTANCE_ID || '';
const apiTokenInstance = process.env.GREEN_API_TOKEN || '';

/**
 * Sends a WhatsApp message using Green API
 * @param phoneNumber - Recipient's phone number in international format (e.g., 79xxxxxxxxx)
 * @param message - Text message to send
 */
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  try {
    if (!idInstance || !apiTokenInstance) {
      console.error('Green API credentials are not configured');
      return false;
    }

    // Format phone number - remove any non-digit characters
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Send message using Green API
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
    const payload = {
      chatId: `${formattedPhone}@c.us`,
      message: message
    };

    const response = await axios.post(url, payload);
    
    if (response.data && response.data.idMessage) {
      return true;
    } else {
      console.error('Failed to send WhatsApp message:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

/**
 * Checks if a phone number is registered with WhatsApp
 * @param phoneNumber - Phone number to check in international format
 */
export async function checkWhatsAppAvailability(phoneNumber: string): Promise<boolean> {
  try {
    if (!idInstance || !apiTokenInstance) {
      console.error('Green API credentials are not configured');
      return false;
    }

    // Format phone number - remove any non-digit characters
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Check phone using Green API
    const url = `https://api.green-api.com/waInstance${idInstance}/checkWhatsapp/${apiTokenInstance}`;
    const payload = {
      phoneNumber: formattedPhone
    };

    const response = await axios.post(url, payload);
    
    if (response.data && response.data.existsWhatsapp === true) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error checking WhatsApp availability:', error);
    return false;
  }
}
