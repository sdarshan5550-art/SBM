import crypto from 'crypto';
import {
  IPaymentGatewayAdapter,
  PaymentGatewayProviderType,
  PropertyGatewayConfig,
  CreateOrderParams,
  PaymentOrderResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  WebhookVerifyParams,
  WebhookVerifyResult,
  RefundParams,
  RefundResult
} from '../types';

export class StripeAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'stripe';

  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const secretKey = config.key_secret;
    if (!secretKey) {
      throw new Error(`Stripe Secret Key missing for ${config.property_name}.`);
    }

    const amountInSmallestUnit = params.amountInPaise;
    const currency = (params.currency || 'INR').toLowerCase();

    const formBody = new URLSearchParams();
    formBody.append('amount', amountInSmallestUnit.toString());
    formBody.append('currency', currency);
    formBody.append('description', `${config.property_name} Booking ${params.receipt}`);
    formBody.append('metadata[booking_number]', params.receipt);
    formBody.append('metadata[property_code]', config.property_code);
    formBody.append('metadata[property_name]', config.property_name);
    formBody.append('metadata[bank_account]', config.bank_account_name);

    if (params.customer?.email) {
      formBody.append('receipt_email', params.customer.email);
    }

    console.log(
      `[Stripe Adapter - ${config.property_code}] Creating PaymentIntent: receipt=${params.receipt}, amount=${amountInSmallestUnit} ${currency}`
    );

    try {
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody.toString()
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorDesc = data?.error?.message || 'Stripe PaymentIntent creation failed';
        console.error(`[Stripe Error - ${config.property_code}]`, errorDesc);
        throw new Error(`Stripe Error (${config.property_name}): ${errorDesc}`);
      }

      const accountLast4 = config.settlement_account_number
        ? config.settlement_account_number.slice(-4)
        : '****';

      return {
        order_id: data.id,
        provider: 'stripe',
        amount: amountInSmallestUnit,
        currency: currency.toUpperCase(),
        key_id: config.key_id, // Stripe publishable key
        property_code: config.property_code,
        property_name: config.property_name,
        bank_account_name: config.bank_account_name,
        settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
        merchant_id: config.merchant_id,
        payment_url: data.client_secret,
        raw_response: data
      };
    } catch (err: any) {
      console.error(`[Stripe Exception - ${config.property_code}]`, err);
      if (config.mode === 'test') {
        console.warn(`[Stripe Adapter - ${config.property_code}] Sandbox test mode: Simulating order.`);
        const accountLast4 = config.settlement_account_number ? config.settlement_account_number.slice(-4) : '****';
        const simId = `pi_sim_${Date.now()}`;
        return {
          order_id: simId,
          provider: 'stripe',
          amount: amountInSmallestUnit,
          currency: currency.toUpperCase(),
          key_id: config.key_id,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name,
          settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
          merchant_id: config.merchant_id,
          payment_url: `${simId}_secret_test`,
          raw_response: { id: simId, simulated: true }
        };
      }
      throw new Error(`Stripe Order Failure (${config.property_name}): ${err.message}`);
    }
  }

  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const secretKey = config.key_secret;
    const paymentIntentId = params.transaction_id || params.order_id;

    try {
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`
        }
      });

      const data: any = await response.json();
      const isPaid = data?.status === 'succeeded';

      return {
        isValid: isPaid,
        transaction_id: data?.id || paymentIntentId,
        order_id: data?.id || paymentIntentId,
        amount: data?.amount ? data.amount / 100 : undefined,
        currency: (data?.currency || 'inr').toUpperCase(),
        status: isPaid ? 'SUCCESS' : (data?.status === 'requires_payment_method' ? 'FAILED' : 'PENDING'),
        method: 'online_stripe',
        raw_response: data
      };
    } catch (err: any) {
      if (config.mode === 'test') {
        return {
          isValid: true,
          transaction_id: params.transaction_id || `ch_sim_${Date.now()}`,
          order_id: paymentIntentId,
          status: 'SUCCESS',
          method: 'online_stripe'
        };
      }
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: params.order_id,
        status: 'FAILED',
        error: err.message
      };
    }
  }

  public async verifyWebhook(
    config: PropertyGatewayConfig,
    params: WebhookVerifyParams
  ): Promise<WebhookVerifyResult> {
    const webhookSecret = config.webhook_secret;
    if (!webhookSecret || !params.signatureHeader) {
      return { isValid: false, error: 'Missing Stripe webhook signature header or secret.' };
    }

    try {
      // Parse Stripe signature header format: t=timestamp,v1=signature
      const parts = params.signatureHeader.split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {} as Record<string, string>);

      const timestamp = parts['t'];
      const signature = parts['v1'];

      if (!timestamp || !signature) {
        return { isValid: false, error: 'Invalid Stripe signature header format.' };
      }

      const signedPayload = `${timestamp}.${params.rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const isValid = expectedSignature === signature;
      if (!isValid) {
        return { isValid: false, error: 'Stripe webhook signature mismatch.' };
      }

      const body = JSON.parse(params.rawBody);
      const eventType = body?.type;
      const object = body?.data?.object;

      const isSuccess = eventType === 'payment_intent.succeeded';
      const isFailed = eventType === 'payment_intent.payment_failed';

      return {
        isValid: true,
        event: eventType,
        order_id: object?.id,
        transaction_id: object?.id,
        amount: object?.amount ? object.amount / 100 : undefined,
        currency: object?.currency?.toUpperCase(),
        status: isSuccess ? 'SUCCESS' : (isFailed ? 'FAILED' : 'OTHER')
      };
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  }

  public async processRefund(
    config: PropertyGatewayConfig,
    params: RefundParams
  ): Promise<RefundResult> {
    const secretKey = config.key_secret;
    const formBody = new URLSearchParams();
    formBody.append('payment_intent', params.transaction_id);
    formBody.append('amount', Math.round(params.amount * 100).toString());
    if (params.reason) {
      formBody.append('reason', 'requested_by_customer');
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody.toString()
      });

      const data: any = await response.json();
      const isSuccess = data?.status === 'succeeded' || data?.status === 'pending';

      return {
        success: isSuccess,
        refund_id: data?.id,
        amount: params.amount,
        status: data?.status === 'succeeded' ? 'PROCESSED' : 'PENDING',
        raw_response: data
      };
    } catch (err: any) {
      return {
        success: false,
        amount: params.amount,
        status: 'FAILED',
        error: err.message
      };
    }
  }
}
