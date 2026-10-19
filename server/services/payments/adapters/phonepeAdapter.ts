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

export class PhonePeAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'phonepe';

  private getEndpoint(mode: 'test' | 'live' | 'unconfigured'): string {
    return mode === 'live'
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
  }

  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const merchantId = config.merchant_id || 'PGTESTPAYUAT';
    const saltKey = config.key_secret || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = '1';

    const merchantTransactionId = `TXN_${params.receipt.replace(/[^A-Za-z0-9]/g, '_')}_${Date.now()}`;
    const amountInPaise = params.amountInPaise;

    const payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId: params.customer?.contact || `MUID_${Date.now()}`,
      amount: amountInPaise,
      redirectUrl: params.returnUrl || `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}`,
      redirectMode: 'POST',
      callbackUrl: config.webhook_url,
      mobileNumber: params.customer?.contact,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = `${sha256}###${saltIndex}`;

    console.log(
      `[PhonePe Adapter - ${config.property_code}] Initiating Pay Request: txnId=${merchantTransactionId}, amount=${amountInPaise} paise, merchantId=${merchantId}`
    );

    const baseUrl = this.getEndpoint(config.mode);

    try {
      const response = await fetch(`${baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'User-Agent': `SBM-${config.property_code}/1.0`
        },
        body: JSON.stringify({ request: base64Payload })
      });

      const responseData: any = await response.json();

      if (!response.ok || !responseData.success) {
        const errorDesc = responseData.message || 'PhonePe payment initiation failed';
        console.error(`[PhonePe Error - ${config.property_code}]`, errorDesc);
        throw new Error(`PhonePe Error (${config.property_name}): ${errorDesc}`);
      }

      const redirectUrl = responseData.data?.instrumentResponse?.redirectInfo?.url;
      const accountLast4 = config.settlement_account_number
        ? config.settlement_account_number.slice(-4)
        : '****';

      return {
        order_id: merchantTransactionId,
        provider: 'phonepe',
        amount: amountInPaise,
        currency: 'INR',
        key_id: config.key_id,
        property_code: config.property_code,
        property_name: config.property_name,
        bank_account_name: config.bank_account_name,
        settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
        merchant_id: merchantId,
        payment_url: redirectUrl,
        raw_response: responseData
      };
    } catch (err: any) {
      console.error(`[PhonePe Exception - ${config.property_code}]`, err);
      if (config.mode === 'test') {
        console.warn(`[PhonePe Adapter - ${config.property_code}] Sandbox test mode: Simulating order.`);
        const accountLast4 = config.settlement_account_number ? config.settlement_account_number.slice(-4) : '****';
        return {
          order_id: merchantTransactionId,
          provider: 'phonepe',
          amount: amountInPaise,
          currency: 'INR',
          key_id: config.key_id,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name,
          settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
          merchant_id: merchantId,
          payment_url: `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}`,
          raw_response: { success: true, simulated: true }
        };
      }
      throw new Error(`PhonePe Order Failure (${config.property_name}): ${err.message}`);
    }
  }

  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const merchantId = config.merchant_id || 'PGTESTPAYUAT';
    const saltKey = config.key_secret || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = '1';
    const merchantTransactionId = params.order_id || params.transaction_id;

    const stringToHash = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = `${sha256}###${saltIndex}`;

    const baseUrl = this.getEndpoint(config.mode);

    try {
      const response = await fetch(`${baseUrl}/pg/v1/status/${merchantId}/${merchantTransactionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      });

      const responseData: any = await response.json();
      const code = responseData?.code;
      const isSuccess = code === 'PAYMENT_SUCCESS';

      return {
        isValid: isSuccess,
        transaction_id: responseData?.data?.transactionId || merchantTransactionId,
        order_id: merchantTransactionId,
        amount: responseData?.data?.amount ? responseData.data.amount / 100 : undefined,
        currency: 'INR',
        status: isSuccess ? 'SUCCESS' : (code === 'PAYMENT_PENDING' ? 'PENDING' : 'FAILED'),
        method: 'online_phonepe',
        error: isSuccess ? undefined : (responseData?.message || 'Payment not verified'),
        raw_response: responseData
      };
    } catch (err: any) {
      if (config.mode === 'test') {
        return {
          isValid: true,
          transaction_id: params.transaction_id || `pp_txn_${Date.now()}`,
          order_id: merchantTransactionId,
          status: 'SUCCESS',
          method: 'online_phonepe'
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
    const saltKey = config.key_secret || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = '1';

    try {
      const body = JSON.parse(params.rawBody);
      const responseBase64 = body.response;

      if (!responseBase64 || !params.signatureHeader) {
        return { isValid: false, error: 'Missing response payload or X-VERIFY signature header.' };
      }

      const stringToHash = responseBase64 + saltKey;
      const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const expectedVerify = `${sha256}###${saltIndex}`;

      const isValid = expectedVerify === params.signatureHeader;
      if (!isValid) {
        return { isValid: false, error: 'PhonePe webhook signature checksum mismatch.' };
      }

      const decoded = JSON.parse(Buffer.from(responseBase64, 'base64').toString('utf-8'));
      const isSuccess = decoded.code === 'PAYMENT_SUCCESS';
      const orderId = decoded.data?.merchantTransactionId;
      const txnId = decoded.data?.transactionId;
      const amount = decoded.data?.amount ? decoded.data.amount / 100 : undefined;

      return {
        isValid: true,
        event: decoded.code,
        order_id: orderId,
        transaction_id: txnId,
        amount,
        currency: 'INR',
        status: isSuccess ? 'SUCCESS' : 'FAILED'
      };
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  }

  public async processRefund(
    config: PropertyGatewayConfig,
    params: RefundParams
  ): Promise<RefundResult> {
    const merchantId = config.merchant_id || 'PGTESTPAYUAT';
    const saltKey = config.key_secret || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = '1';

    const merchantTransactionId = `REF_${Date.now()}`;
    const amountInPaise = Math.round(params.amount * 100);

    const payload = {
      merchantId,
      merchantUserId: 'SBM_REFUND_ADMIN',
      originalTransactionId: params.transaction_id,
      merchantTransactionId,
      amount: amountInPaise,
      callbackUrl: config.webhook_url
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/refund' + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = `${sha256}###${saltIndex}`;

    const baseUrl = this.getEndpoint(config.mode);

    try {
      const response = await fetch(`${baseUrl}/pg/v1/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        },
        body: JSON.stringify({ request: base64Payload })
      });

      const responseData: any = await response.json();
      const isSuccess = responseData.code === 'PAYMENT_SUCCESS';

      return {
        success: isSuccess,
        refund_id: responseData.data?.transactionId || merchantTransactionId,
        amount: params.amount,
        status: isSuccess ? 'PROCESSED' : 'FAILED',
        error: isSuccess ? undefined : responseData.message,
        raw_response: responseData
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
