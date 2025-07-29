// SMS sending service (fake)
async function sendSMS(phoneNumber, code) {
  // Here you can replace with Twilio in the future
  console.log(`SMS to ${phoneNumber}: Your verification code is ${code}`);
}

// Function to send WhatsApp
async function sendWhatsApp(phoneNumber, message) {
  try {
    // If you have Twilio WhatsApp Business API
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: `whatsapp:${phoneNumber}`
      });
      
      console.log(`WhatsApp sent successfully to ${phoneNumber}`);
    } 
    // If you have Callmebot API (free)
    else if (process.env.CALLMEBOT_API_KEY) {
      const axios = require('axios');
      
      // URL encoding of the message
      const encodedMessage = encodeURIComponent(message);
      
      const response = await axios.get(`https://api.callmebot.com/whatsapp.php`, {
        params: {
          phone: phoneNumber,
          text: message,
          apikey: process.env.CALLMEBOT_API_KEY
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ WhatsApp sent successfully to ${phoneNumber} via Callmebot`);
      } else {
        console.log(`⚠️ Response from Callmebot: ${response.status}`);
      }
    }
    // If you have WhatsApp Web API
    else if (process.env.WHATSAPP_WEB_URL) {
      const axios = require('axios');
      
      await axios.post(process.env.WHATSAPP_WEB_URL, {
        phone: phoneNumber,
        message: message
      });
      
      console.log(`WhatsApp sent successfully to ${phoneNumber}`);
    }
    // If nothing is available, print log (for development)
    else {
      console.log(`📱 WhatsApp to ${phoneNumber}:`);
      console.log(`📄 Message: ${message}`);
      console.log(`💡 To send real WhatsApp, add one of the following to .env:`);
      console.log(`   - CALLMEBOT_API_KEY (free)`);
      console.log(`   - TWILIO_* (paid)`);
      console.log(`   - WHATSAPP_WEB_URL`);
    }
  } catch (err) {
    console.error('Error sending WhatsApp:', err.message);
    if (err.response) {
      console.error('Error response:', err.response.data);
    }
  }
}

module.exports = { sendSMS, sendWhatsApp }; 