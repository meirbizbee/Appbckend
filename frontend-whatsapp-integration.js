// frontend-whatsapp-integration.js
// דוגמה לעדכון הפרונט שלך

import { Alert, Linking, Platform } from "react-native";

export const sendWhatsAppMessage = async (
  productName: string,
  fullName: string,
  phoneNumber: string,
  userId?: string
) => {
  const message = `Hello Biz-Bee
I would like to start a new campaign,  
for the ${productName}
 ${fullName}`;
  
  const whatsappUrl = `https://wa.me/35677064023?text=${encodeURIComponent(message)}`;
  
  try {
    // שליחת הודעה לבקאנד (אופציונלי - כדי לקבל התראה)
    if (userId) {
      await fetch('http://localhost:3000/api/users/whatsapp-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName,
          fullName,
          phoneNumber,
          userId
        })
      });
    }
    
    // פתיחת ווטסאפ אצל היוזר
    if (Platform.OS === "web") {
      window.alert(`Thank you ${fullName} for your inquiry. We will now transfer you to WhatsApp to send a message.
          We will get back to ${phoneNumber} within 24 hours.`);
      window.open(whatsappUrl, "_blank");
    } else {
      Alert.alert(
        `Thank you ${fullName} for your inquiry.
             We will now transfer you to WhatsApp to send a message.`,
        `We will get back to ${phoneNumber} within 24 hours.`,
        [
          {
            text: "ok",
            onPress: () => {
              Linking.openURL(whatsappUrl).catch((err) => {
                console.error("Error opening WhatsApp:", err);
              });
            },
          },
        ],
      );
    }
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    // עדיין נפתח ווטסאפ גם אם הבקאנד נכשל
  }
};

export default sendWhatsAppMessage; 