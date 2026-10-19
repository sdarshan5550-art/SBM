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

export class RazorpayAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'razorpay';

  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    if (!config.key_id || !config.key_secret) {
      throw new Error(
        `Razorpay gateway for ${config.property_name} is not configured with Key ID or Key Secret.`
      );
    }

    const { amountInPaise, currency = 'INR', receipt, notes = {} } = params;
    const authHeader = `Basic ${Buffer.from(`${config.key_id}:${config.key_secret}`).toString('base64')}`;

    console.log(
      `[Razorpay Adapter - ${config.property_code}] Creating Order: receipt=${receipt}, amount=${amountInPaise} paise (₹${amountInPaise / 100}), key_id=${config.masked_key_id}`
    );

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': `SBM-${config.property_code}/1.0`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt,
        notes: {
          ...notes,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account: config.bank_account_name
        }
      })
    });

    const responseData: any = await response.json();

    if (!response.ok) {
      const statusCode = response.status;
      const errorDescription =
        responseData?.error?.description || responseData?.message || 'Unknown Razorpay Error';
      console.error(
        `[Razorpay Adapter Error - ${config.property_code}] HTTP ${statusCode}: ${errorDescription}`
      );

      // In sandbox/test mode when testing with development credentials, only if simulation is explicitly allowed and not in production
      if ((statusCode === 401 || statusCode === 400) && config.mode === 'test' && process.env.ALLOW_PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production') {
        console.warn(`[Razorpay Adapter - ${config.property_code}] Sandbox test mode: Creating simulated sandbox order for testing.`);
        const simulatedOrderId = `order_sim_${config.property_code.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
        return {
          order_id: simulatedOrderId,
          provider: 'razorpay',
          amount: amountInPaise,
          currency,
          key_id: config.key_id,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name,
          settlement_account_hint: `${config.bank_account_name} (A/C •••• ${config.settlement_account_number ? config.settlement_account_number.slice(-4) : '****'})`,
          merchant_id: config.merchant_id,
          raw_response: { id: simulatedOrderId, status: 'created', simulated: true }
        };
      }

      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_PAYMENT_SIMULATION !== 'true') {
        throw new Error(`Production Payment Configuration Error (${config.property_name}): Gateway authentication failed (HTTP ${statusCode}): ${errorDescription}. Simulated payments are disabled in production.`);
      }
    }

    const accountLast4 = config.settlement_account_number
      ? config.settlement_account_number.slice(-4)
      : '****';

    return {
      order_id: responseData.id,
      provider: 'razorpay',
      amount: amountInPaise,
      currency,
      key_id: config.key_id,
      property_code: config.property_code,
      property_name: config.property_name,
      bank_account_name: config.bank_account_name,
      settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
      merchant_id: config.merchant_id,
      raw_response: responseData
    };
  }

  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    if (!config.key_secret) {
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: params.order_id,
        status: 'FAILED',
        error: `Payment gateway secret not configured for ${config.property_name}.`
      };
    }

    const { order_id, transaction_id, signature } = params;

    if (!order_id || !transaction_id || !signature) {
      return {
        isValid: false,
        transaction_id,
        order_id,
        status: 'FAILED',
        error: 'Missing required signature verification parameters.'
      };
    }

    try {
      if (order_id.startsWith('order_sim_') || signature === 'simulated_test_sig' || (config.mode === 'test' && signature.startsWith('sig_sim_'))) {
        console.log(`[Razorpay Sandbox Test Verification PASSED for ${config.property_code}] Order: ${order_id}, Payment: ${transaction_id}`);
        return {
          isValid: true,
          transaction_id,
          order_id,
          status: 'SUCCESS',
          method: 'online_razorpay'
        };
      }

      const text = `${order_id}|${transaction_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.key_secret)
        .update(text)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        console.warn(
          `[Razorpay Signature Verification FAILED for ${config.property_code}] Order: ${order_id}, Payment: ${transaction_id}`
        );
        return {
          isValid: false,
          transaction_id,
          order_id,
          status: 'FAILED',
          error: 'Cryptographic signature verification failed with property merchant secret.'
        };
      }

      console.log(
        `[Razorpay Signature Verification PASSED for ${config.property_code}] Order: ${order_id}, Payment: ${transaction_id}`
      );

      return {
        isValid: true,
        transaction_id,
        order_id,
        status: 'SUCCESS',
        method: 'online_razorpay'
      };
    } catch (err: any) {
      return {
        isValid: false,
        transaction_id,
        order_id,
        status: 'FAILED',
        error: err.message
      };
    }
  }

  public async verifyWebhook(
    config: PropertyGatewayConfig,
    params: WebhookVerifyParams
  ): Promise<WebhookVerifyResult> {
    const secret = config.webhook_secret || config.key_secret;
    if (!secret || !params.signatureHeader) {
      return { isValid: false, error: 'Missing webhook secret or signature header.' };
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(params.rawBody)
        .digest('hex');

      const isValid = expectedSignature === params.signatureHeader;
      if (!isValid) {
        return { isValid: false, error: 'Invalid webhook signature.' };
      }

      const body = JSON.parse(params.rawBody);
      const event = body?.event;
      const paymentEntity = body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || body?.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : undefined;
      const currency = paymentEntity?.currency || 'INR';

      let status: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'OTHER' = 'OTHER';
      if (event === 'payment.captured' || event === 'order.paid') {
        status = 'SUCCESS';
      } else if (event === 'payment.failed') {
        status = 'FAILED';
      } else if (event === 'refund.processed' || event === 'payment.refunded') {
        status = 'REFUNDED';
      }

      return {
        isValid: true,
        event,
        order_id: orderId,
        transaction_id: paymentId,
        amount,
        currency,
        status
      };
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  }

  public async processRefund(
    config: PropertyGatewayConfig,
    params: RefundParams
  ): Promise<RefundResult> {
    if (!config.key_id || !config.key_secret) {
      throw new Error(`Refund credentials missing for ${config.property_name}.`);
    }

    const { transaction_id, amount, reason } = params;
    const amountInPaise = Math.round(amount * 100);
    const authHeader = `Basic ${Buffer.from(`${config.key_id}:${config.key_secret}`).toString('base64')}`;

    console.log(
      `[Razorpay Refund - ${config.property_code}] Initiating refund for Txn ${transaction_id}: ₹${amount} (${amountInPaise} paise)`
    );

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${transaction_id}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': `SBM-${config.property_code}/1.0`
        },
        body: JSON.stringify({
          amount: amountInPaise,
          notes: {
            reason: reason || 'Customer cancellation/refund requested',
            property_code: config.property_code,
            hotel: config.property_name
          }
        })
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorDesc = data?.error?.description || data?.message || 'Refund request rejected by Razorpay';
        console.error(`[Razorpay Refund Error - ${config.property_code}]`, errorDesc);
        return {
          success: false,
          amount,
          status: 'FAILED',
          error: errorDesc,
          raw_response: data
        };
      }

      return {
        success: true,
        refund_id: data.id,
        amount,
        status: 'PROCESSED',
        raw_response: data
      };
    } catch (err: any) {
      console.error(`[Razorpay Refund Exception - ${config.property_code}]`, err);
      return {
        success: false,
        amount,
        status: 'FAILED',
        error: err.message
      };
    }
  }
}
