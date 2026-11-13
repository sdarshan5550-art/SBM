import {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  RefundRequest,
  Env
} from 'phonepe-pg-sdk-node';
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

export class PhonePeAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'phonepe';
  private clients: Map<string, StandardCheckoutClient> = new Map();

  private getClient(config: PropertyGatewayConfig): StandardCheckoutClient {
    const clientId = config.client_id || config.key_id;
    const clientSecret = config.client_secret || config.key_secret;
    const clientVersion = config.client_version || 1;
    const phonepeEnvStr = String(config.phonepe_env || '').toUpperCase();
    const env = phonepeEnvStr === 'SANDBOX' ? Env.SANDBOX : Env.PRODUCTION;

    if (!clientId || !clientSecret) {
      throw new Error(
        `PhonePe Standard Checkout credentials missing or unconfigured for ${config.property_name} (${config.property_code}). ` +
        `Please configure SBM2_PHONEPE_CLIENT_ID and SBM2_PHONEPE_CLIENT_SECRET in environment variables.`
      );
    }

    const cacheKey = `${config.property_code}_${clientId}_${clientVersion}_${env}`;
    let client = this.clients.get(cacheKey);
    if (!client) {
      client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env, false);
      this.clients.set(cacheKey, client);
    }
    return client;
  }

  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const client = this.getClient(config);
    const merchantOrderId = `TXN_${params.receipt.replace(/[^A-Za-z0-9]/g, '_')}_${Date.now()}`.slice(0, 60);
    const amountInPaise = params.amountInPaise;
    const redirectUrl = params.returnUrl || `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}`;

    console.log(
      `[PhonePe Standard Checkout - ${config.property_code}] Initiating Order: orderId=${merchantOrderId}, amount=${amountInPaise} paise, env=${config.phonepe_env || 'PRODUCTION'}`
    );

    const payRequest = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .build();

    try {
      const response = await client.pay(payRequest);

      if (!response || !response.redirectUrl) {
        throw new Error(`PhonePe Standard Checkout: No checkout redirect URL returned by PhonePe API.`);
      }

      console.log(
        `[PhonePe Standard Checkout - ${config.property_code}] Order Created Successfully: orderId=${merchantOrderId}, state=${response.state}`
      );

      const accountLast4 = config.settlement_account_number
        ? config.settlement_account_number.slice(-4)
        : '****';

      return {
        order_id: merchantOrderId,
        provider: 'phonepe',
        amount: amountInPaise,
        currency: 'INR',
        key_id: config.client_id || config.key_id,
        property_code: config.property_code,
        property_name: config.property_name,
        bank_account_name: config.bank_account_name,
        settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
        merchant_id: config.client_id || config.key_id,
        payment_url: response.redirectUrl,
        raw_response: response
      };
    } catch (err: any) {
      console.error(`[PhonePe Standard Checkout Error - ${config.property_code}]`, err.message || err);

      // Simulation fallback strictly controlled by ALLOW_PAYMENT_SIMULATION
      if (process.env.ALLOW_PAYMENT_SIMULATION === 'true') {
        console.warn(`[PhonePe Simulator - ${config.property_code}] Simulation mode explicitly enabled via ALLOW_PAYMENT_SIMULATION=true.`);
        const simulatedUrl = `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}&payment_status=success`;
        return {
          order_id: merchantOrderId,
          provider: 'phonepe',
          amount: amountInPaise,
          currency: 'INR',
          key_id: config.client_id || config.key_id,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name,
          settlement_account_hint: `${config.bank_account_name}`,
          merchant_id: config.client_id || config.key_id,
          payment_url: simulatedUrl,
          raw_response: { simulated: true, error: err.message }
        };
      }

      const detail = err.httpStatusCode ? ` (HTTP ${err.httpStatusCode} ${err.code || ''})` : '';
      throw new Error(`PhonePe Payment Initiation Failed (${config.property_name}): ${err.message || 'Authentication or API error'}${detail}`);
    }
  }

  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const client = this.getClient(config);
    const merchantOrderId = params.order_id || params.transaction_id;

    console.log(`[PhonePe Standard Checkout - ${config.property_code}] Verifying Order Status: orderId=${merchantOrderId}`);

    try {
      const orderStatus = await client.getOrderStatus(merchantOrderId, true);

      console.log(`[PhonePe Standard Checkout - ${config.property_code}] Order Status Response: state=${orderStatus?.state}`);

      const state = (orderStatus?.state || '').toUpperCase();
      const isSuccess = state === 'COMPLETED';
      const isPending = state === 'PENDING';

      return {
        isValid: isSuccess,
        transaction_id: orderStatus?.orderId || merchantOrderId,
        order_id: orderStatus?.merchantOrderId || merchantOrderId,
        amount: orderStatus?.amount ? orderStatus.amount / 100 : undefined,
        currency: 'INR',
        status: isSuccess ? 'SUCCESS' : (isPending ? 'PENDING' : 'FAILED'),
        method: 'online_phonepe',
        error: isSuccess ? undefined : (orderStatus?.errorCode || orderStatus?.detailedErrorCode || `Payment status: ${state}`),
        raw_response: orderStatus
      };
    } catch (err: any) {
      console.error(`[PhonePe Standard Checkout Verify Error - ${config.property_code}]`, err.message || err);
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: params.order_id,
        status: 'FAILED',
        error: err.message || 'Failed to verify payment status with PhonePe API.'
      };
    }
  }

  public async verifyWebhook(
    config: PropertyGatewayConfig,
    params: WebhookVerifyParams
  ): Promise<WebhookVerifyResult> {
    try {
      const client = this.getClient(config);
      const username = config.webhook_username || process.env.SBM2_PHONEPE_WEBHOOK_USERNAME || '';
      const password = config.webhook_password || process.env.SBM2_PHONEPE_WEBHOOK_PASSWORD || '';

      const authHeader =
        params.authorizationHeader ||
        (params.headers?.['authorization'] as string) ||
        (params.headers?.['Authorization'] as string) ||
        params.signatureHeader ||
        '';

      const rawBodyString = params.rawBodyString || (
        typeof params.rawBody === 'string' ? params.rawBody : JSON.stringify(params.rawBody)
      );

      if (!username || !password) {
        console.warn(`[PhonePe Webhook - ${config.property_code}] Webhook username or password not configured (SBM2_PHONEPE_WEBHOOK_USERNAME / SBM2_PHONEPE_WEBHOOK_PASSWORD).`);
        return {
          isValid: false,
          error: 'PhonePe webhook credentials unconfigured.'
        };
      }

      if (!authHeader) {
        console.warn(`[PhonePe Webhook - ${config.property_code}] Missing Authorization header in PhonePe webhook request.`);
        return {
          isValid: false,
          error: 'Missing Authorization header.'
        };
      }

      // Official PhonePe Standard Checkout SDK callback validation:
      // client.validateCallback(username, password, authorizationHeader, responseBodyString)
      const callbackResponse = client.validateCallback(
        username,
        password,
        authHeader,
        rawBodyString
      );

      console.log(`[PhonePe Webhook - ${config.property_code}] Callback validated successfully via PhonePe SDK.`);

      const payload = callbackResponse.payload;
      const state = (payload?.state || '').toUpperCase();
      const isSuccess = state === 'COMPLETED';

      return {
        isValid: isSuccess,
        order_id: payload?.merchantOrderId || payload?.orderId,
        transaction_id: payload?.orderId,
        amount: typeof payload?.amount === 'number' ? payload.amount / 100 : undefined,
        currency: 'INR',
        status: isSuccess ? 'SUCCESS' : (state === 'FAILED' ? 'FAILED' : 'OTHER'),
        error: isSuccess ? undefined : (payload?.detailedErrorCode || payload?.errorCode || `PhonePe payment state: ${state}`)
      };
    } catch (err: any) {
      console.error(`[PhonePe Webhook Error - ${config.property_code}]`, err.message || err);
      return {
        isValid: false,
        error: `PhonePe webhook verification failed: ${err.message || 'Invalid callback'}`
      };
    }
  }

  public async processRefund(
    config: PropertyGatewayConfig,
    params: RefundParams
  ): Promise<RefundResult> {
    const client = this.getClient(config);
    const merchantRefundId = `REF_${params.property_code}_${Date.now()}`;
    const amountInPaise = Math.round(params.amount * 100);

    try {
      const refundReq = RefundRequest.builder()
        .merchantRefundId(merchantRefundId)
        .originalMerchantOrderId(params.order_id || params.transaction_id)
        .amount(amountInPaise)
        .build();

      const response = await client.refund(refundReq);
      return {
        success: response?.state === 'COMPLETED',
        refund_id: response?.refundId || merchantRefundId,
        amount: params.amount,
        status: response?.state === 'COMPLETED' ? 'PROCESSED' : 'PENDING'
      };
    } catch (err: any) {
      console.error(`[PhonePe Refund Error - ${config.property_code}]`, err.message || err);
      return {
        success: false,
        amount: params.amount,
        status: 'FAILED'
      };
    }
  }
}
