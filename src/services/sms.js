// שירות שליחת SMS (פייק)
async function sendSMS(phoneNumber, code) {
  // כאן אפשר להחליף ל-Twilio בעתיד
  console.log(`SMS ל- ${phoneNumber}: קוד האימות שלך הוא ${code}`);
}

// פונקציה לשליחת ווטסאפ
async function sendWhatsApp(phoneNumber, message) {
  try {
    // אם יש לך Twilio WhatsApp Business API
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: `whatsapp:${phoneNumber}`
      });
      
      console.log(`ווטסאפ נשלח בהצלחה ל- ${phoneNumber}`);
    } 
    // אם יש לך Callmebot API (חינמי)
    else if (process.env.CALLMEBOT_API_KEY) {
      const axios = require('axios');
      
      // URL encoding של ההודעה
      const encodedMessage = encodeURIComponent(message);
      
      const response = await axios.get(`https://api.callmebot.com/whatsapp.php`, {
        params: {
          phone: phoneNumber,
          text: message,
          apikey: process.env.CALLMEBOT_API_KEY
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ ווטסאפ נשלח בהצלחה ל- ${phoneNumber} דרך Callmebot`);
      } else {
        console.log(`⚠️ תגובה מ-Callmebot: ${response.status}`);
      }
    }
    // אם יש לך WhatsApp Web API
    else if (process.env.WHATSAPP_WEB_URL) {
      const axios = require('axios');
      
      await axios.post(process.env.WHATSAPP_WEB_URL, {
        phone: phoneNumber,
        message: message
      });
      
      console.log(`ווטסאפ נשלח בהצלחה ל- ${phoneNumber}`);
    }
    // אם אין שום דבר, נדפיס לוג (לפיתוח)
    else {
      console.log(`📱 ווטסאפ ל- ${phoneNumber}:`);
      console.log(`📄 הודעה: ${message}`);
      console.log(`💡 כדי לשלוח ווטסאפ אמיתי, הוסף אחד מהבאים ל-.env:`);
      console.log(`   - CALLMEBOT_API_KEY (חינמי)`);
      console.log(`   - TWILIO_* (בתשלום)`);
      console.log(`   - WHATSAPP_WEB_URL`);
    }
  } catch (err) {
    console.error('שגיאה בשליחת ווטסאפ:', err.message);
    if (err.response) {
      console.error('תגובת שגיאה:', err.response.data);
    }
  }
}

module.exports = { sendSMS, sendWhatsApp }; 