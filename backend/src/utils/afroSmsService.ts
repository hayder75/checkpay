/**
 * AfroMessage SMS Service
 * Sends SMS messages via AfroMessage API
 * 
 * Environment Variables Required:
 * - AFRO_SMS_API_KEY: Your AfroMessage API key/token
 * - AFRO_SMS_API_URL: (Optional) Custom API endpoint URL
 * - AFRO_SMS_SENDER_NAME: (Optional) Default sender name (default: "CheckPay")
 */

interface SendSMSOptions {
  to: string;
  message: string;
  senderName?: string;
}

interface AfroSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format phone number for AfroMessage API
 * Ensures phone number is in international format (+251...)
 */
function formatPhoneNumber(phone: string): string {
  // Remove any spaces, dashes, or other characters
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If starts with 0, replace with country code (Ethiopia: +251)
  if (cleaned.startsWith('0')) {
    cleaned = '+251' + cleaned.substring(1);
  }
  // If doesn't start with +, add +251 (assuming Ethiopia)
  else if (!cleaned.startsWith('+')) {
    cleaned = '+251' + cleaned;
  }
  
  return cleaned;
}

/**
 * Send SMS via AfroMessage API
 * Tries multiple common API formats to ensure compatibility
 */
export async function sendSMS(options: SendSMSOptions): Promise<AfroSMSResponse> {
  const { to, message, senderName } = options;
  
  // Get API credentials from environment
  const apiKey = process.env.AFRO_SMS_API_KEY;
  // Try multiple possible endpoints
  const possibleUrls = [
    process.env.AFRO_SMS_API_URL,
    'https://api.afromessage.com/api/v1/sms/send',
    'https://api.afromessage.com/v1/sms/send',
    'https://api.afromessage.com/sms/send',
    'https://afromessage.com/api/v1/sms/send',
    'https://afromessage.com/api/sms/send',
  ].filter(Boolean);
  const apiUrl = possibleUrls[0] || 'https://api.afromessage.com/api/v1/sms/send';
  const defaultSenderName = process.env.AFRO_SMS_SENDER_NAME || 'CheckPay';
  
  if (!apiKey) {
    console.error('❌ AFRO_SMS_API_KEY not configured in environment variables');
    throw new Error('SMS service not configured. Please set AFRO_SMS_API_KEY in .env file');
  }
  
  const formattedPhone = formatPhoneNumber(to);
  const sender = senderName || defaultSenderName;
  
  // Try multiple API formats (AfroMessage uses JWT token)
  const apiFormats = [
    // Format 1: AfroMessage standard with Authorization Bearer (JWT token)
    {
      url: apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        to: formattedPhone,
        message: message,
        from: sender,
        sender: sender,
      },
    },
    // Format 2: Try with token in body
    {
      url: 'https://api.afromessage.com/api/v1/sms/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        token: apiKey,
        to: formattedPhone,
        message: message,
        from: sender,
        sender: sender,
      },
    },
    // Format 3: Try different endpoint structure
    {
      url: 'https://api.afromessage.com/v1/sms/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        to: formattedPhone,
        message: message,
        from: sender,
      },
    },
    // Format 4: Try with identifierId (from Python SDK pattern)
    {
      url: 'https://api.afromessage.com/api/v1/sms/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        identifierId: apiKey,
        to: formattedPhone,
        message: message,
        from: sender,
        sender: sender,
      },
    },
  ];
  
  // Try each format until one succeeds
  console.log(`\n📱 ==========================================`);
  console.log(`📱 ATTEMPTING TO SEND SMS VIA AFROMESSAGE`);
  console.log(`📱 ==========================================`);
  console.log(`📱 To: ${formattedPhone}`);
  console.log(`📱 Message: ${message.substring(0, 50)}...`);
  console.log(`📱 Sender: ${sender}`);
  console.log(`📱 API URL: ${apiUrl}`);
  console.log(`📱 API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`📱 ==========================================\n`);

  for (let i = 0; i < apiFormats.length; i++) {
    const format = apiFormats[i];
    const formatNum = i + 1;
    
    console.log(`\n🔄 Trying API Format ${formatNum}/${apiFormats.length}...`);
    console.log(`   URL: ${format.url}`);
    console.log(`   Method: ${format.method}`);
    console.log(`   Headers:`, JSON.stringify(format.headers, null, 2));
    console.log(`   Body:`, JSON.stringify(format.body, null, 2));
    
    try {
      const response = await fetch(format.url, {
        method: format.method,
        headers: format.headers,
        body: JSON.stringify(format.body),
      });
      
      console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);
      console.log(`📥 Response Headers:`, Object.fromEntries(response.headers.entries()));
      
      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
        console.log(`📥 Response Body (JSON):`, JSON.stringify(responseData, null, 2));
      } else {
        responseData = await response.text();
        console.log(`📥 Response Body (Text):`, responseData);
      }
      
      if (response.ok) {
        console.log(`\n✅ ==========================================`);
        console.log(`✅ SMS SENT SUCCESSFULLY!`);
        console.log(`✅ ==========================================`);
        console.log(`✅ Format Used: ${formatNum}`);
        console.log(`✅ Phone: ${formattedPhone}`);
        console.log(`✅ Message ID: ${responseData.messageId || responseData.id || responseData.message_id || responseData.data?.id || 'N/A'}`);
        console.log(`✅ Full Response:`, JSON.stringify(responseData, null, 2));
        console.log(`✅ ==========================================\n`);
        return {
          success: true,
          messageId: responseData.messageId || responseData.id || responseData.message_id || responseData.data?.id,
        };
      } else if (response.status !== 400 && response.status !== 401) {
        // Continue to next format if not a bad request or unauthorized
        console.log(`⚠️  Format ${formatNum} failed (status ${response.status}), trying next format...`);
        continue;
      } else {
        // Bad request or unauthorized - log and return error
        console.log(`\n❌ ==========================================`);
        console.log(`❌ SMS API ERROR (Format ${formatNum})`);
        console.log(`❌ ==========================================`);
        console.log(`❌ Status: ${response.status} ${response.statusText}`);
        console.log(`❌ Error:`, JSON.stringify(responseData, null, 2));
        console.log(`❌ ==========================================\n`);
        return {
          success: false,
          error: responseData.message || responseData.error || `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      // Network error - try next format
      console.log(`\n⚠️  Network Error (Format ${formatNum}):`, error.message);
      if (i === apiFormats.length - 1) {
        // Last format failed
        console.log(`\n❌ ==========================================`);
        console.log(`❌ ALL SMS API FORMATS FAILED`);
        console.log(`❌ ==========================================`);
        console.log(`❌ Error: ${error.message}`);
        console.log(`❌ Stack: ${error.stack}`);
        console.log(`❌ ==========================================\n`);
        return {
          success: false,
          error: error.message || 'Failed to send SMS - all API formats failed',
        };
      }
      continue;
    }
  }
  
  // If all formats failed
  return {
    success: false,
    error: 'Failed to send SMS - all API formats failed',
  };
}

/**
 * Send OTP SMS
 */
export async function sendOTPSMS(phone: string, otpCode: string): Promise<boolean> {
  const message = `Your CheckPay verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nDo not share this code with anyone.`;
  
  try {
    const result = await sendSMS({
      to: phone,
      message: message,
      senderName: 'CheckPay',
    });
    
    return result.success;
  } catch (error: any) {
    console.error('Failed to send OTP SMS:', error.message);
    return false;
  }
}

