export interface OtpDelivery {
  send(phone: string, code: string): Promise<void>;
}

export class ConsoleOtpDelivery implements OtpDelivery {
  async send(phone: string, code: string): Promise<void> {
    if (__DEV__) {
      console.log(
        `[DEV OTP] Phone: ${phone} | Code: ${code} | (This code is printed to console instead of SMS in dev builds)`
      );
    }
  }
}

export class SmsOtpDelivery implements OtpDelivery {
  async send(phone: string, code: string): Promise<void> {
    // Production SMS implementation would go here
    // e.g., using Twilio, Africa's Talking, or other SMS provider
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send SMS OTP');
    }
  }
}

export function getOtpDelivery(): OtpDelivery {
  if (__DEV__ || process.env.NODE_ENV === 'development') {
    return new ConsoleOtpDelivery();
  }
  return new SmsOtpDelivery();
}