import crypto from 'crypto';

export class WebhookVerifierService {
  private static instance: WebhookVerifierService;

  private constructor() {}

  static getInstance(): WebhookVerifierService {
    if (!WebhookVerifierService.instance) {
      WebhookVerifierService.instance = new WebhookVerifierService();
    }
    return WebhookVerifierService.instance;
  }

  verifyHMACSignature(
    payload: string | object,
    signature: string,
    secret: string
  ): boolean {
    try {
      const payloadStr =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

      const signatureParts = signature.split('=');
      if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
        return false;
      }

      const receivedSignature = signatureParts[1];
      const expectedSignature = this.createSignatureDigest(payloadStr, secret);

      if (receivedSignature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  createSignatureDigest(payload: string | object, secret: string): string {
    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadStr);
    return hmac.digest('hex');
  }

  createSignature(payload: string | object, secret: string): string {
    const digest = this.createSignatureDigest(payload, secret);
    return `sha256=${digest}`;
  }

  verifyBearerToken(
    authHeader: string | undefined,
    expectedToken: string
  ): boolean {
    if (!authHeader) {
      return false;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return false;
    }

    const token = parts[1];

    try {
      if (token.length !== expectedToken.length) {
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
    } catch {
      return false;
    }
  }

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export default WebhookVerifierService.getInstance();
