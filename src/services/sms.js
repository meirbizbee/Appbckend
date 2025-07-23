// שירות שליחת SMS (פייק)
async function sendSMS(phoneNumber, code) {
  // כאן אפשר להחליף ל-Twilio בעתיד
  console.log(`SMS ל- ${phoneNumber}: קוד האימות שלך הוא ${code}`);
}

module.exports = { sendSMS }; 