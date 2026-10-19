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

export class CashfreeAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'cashfree';

  private getEndpoint(mode: 'test' | 'live' | 'unconfigured'): string {
    return mode === 'live'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const appId = config.key_id;
    const secretKey = config.key_secret;

    if (!appId || !secretKey) {
      throw new Error(`Cashfree App ID or Secret Key missing for ${config.property_name}.`);
    }

    const orderId = `CF_${params.receipt.replace(/[^A-Za-z0-9]/g, '_')}_${Date.now()}`;
    const amountInRupees = Number((params.amountInPaise / 100).toFixed(2));

    const baseUrl = this.getEndpoint(config.mode);

    const body = {
      order_id: orderId,
      order_amount: amountInRupees,
      order_currency: 'INR',
      customer_details: {
        customer_id: params.customer?.contact || `CUST_${Date.now()}`,
        customer_name: params.customer?.name || 'SBM Guest',
        customer_email: params.customer?.email || 'guest@sbmhotel.com',
        customer_phone: params.customer?.contact || '9999999999'
      },
      order_meta: {
        return_url: params.returnUrl || `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}&cf_order_id={order_id}`,
        notify_url: config.webhook_url
      },
      order_note: `${config.property_name} Booking ${params.receipt}`
    };

    console.log(
      `[Cashfree Adapter - ${config.property_code}] Creating Order: order_id=${orderId}, amount=₹${amountInRupees}, app_id=${config.masked_key_id}`
    );

    try {
      const response = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json',
          'User-Agent': `SBM-${config.property_code}/1.0`
        },
        body: JSON.stringify(body)
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        const errorDesc = responseData?.message || responseData?.error?.message || 'Cashfree Order Failed';
        console.error(`[Cashfree Error - ${config.property_code}]`, errorDesc);
        throw new Error(`Cashfree Error (${config.property_name}): ${errorDesc}`);
      }

      const accountLast4 = config.settlement_account_number
        ? config.settlement_account_number.slice(-4)
        : '****';

      return {
        order_id: responseData.order_id,
        provider: 'cashfree',
        amount: params.amountInPaise,
        currency: 'INR',
        key_id: config.key_id,
        property_code: config.property_code,
        property_name: config.property_name,
        bank_account_name: config.bank_account_name,
        settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
        merchant_id: config.merchant_id,
        payment_url: responseData.payment_link || responseData.order_meta?.payment_methods,
        raw_response: responseData
      };
    } catch (err: any) {
      console.error(`[Cashfree Exception - ${config.property_code}]`, err);
      if (config.mode === 'test') {
        console.warn(`[Cashfree Adapter - ${config.property_code}] Sandbox test mode: Simulating order.`);
        const accountLast4 = config.settlement_account_number ? config.settlement_account_number.slice(-4) : '****';
        return {
          order_id: orderId,
          provider: 'cashfree',
          amount: params.amountInPaise,
          currency: 'INR',
          key_id: config.key_id,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name,
          settlement_account_hint: `${config.bank_account_name} (A/C •••• ${accountLast4})`,
          merchant_id: config.merchant_id,
          payment_url: `${process.env.APP_URL || 'https://sbmhotel.com'}/manage-booking?booking_number=${params.receipt}`,
          raw_response: { order_id: orderId, simulated: true }
        };
      }
      throw new Error(`Cashfree Order Failure (${config.property_name}): ${err.message}`);
    }
  }

  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const appId = config.key_id;
    const secretKey = config.key_secret;
    const orderId = params.order_id;

    const baseUrl = this.getEndpoint(config.mode);

    try {
      const response = await fetch(`${baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01'
        }
      });

      const data: any = await response.json();
      const status = data?.order_status;
      const isPaid = status === 'PAID';

      return {
        isValid: isPaid,
        transaction_id: params.transaction_id || data?.cf_order_id?.toString() || orderId,
        order_id: orderId,
        amount: data?.order_amount,
        currency: data?.order_currency || 'INR',
        status: isPaid ? 'SUCCESS' : (status === 'ACTIVE' ? 'PENDING' : 'FAILED'),
        method: 'online_cashfree',
        raw_response: data
      };
    } catch (err: any) {
      if (config.mode === 'test') {
        return {
          isValid: true,
          transaction_id: params.transaction_id || `cf_txn_${Date.now()}`,
          order_id: orderId,
          status: 'SUCCESS',
          method: 'online_cashfree'
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
    const secretKey = config.webhook_secret || config.key_secret;
    if (!secretKey || !params.signatureHeader) {
      return { isValid: false, error: 'Missing Cashfree webhook signature or secret.' };
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(params.rawBody)
        .digest('base64');

      const isValid = expectedSignature === params.signatureHeader;
      if (!isValid) {
        return { isValid: false, error: 'Cashfree webhook signature mismatch.' };
      }

      const body = JSON.parse(params.rawBody);
      const data = body?.data;
      const order = data?.order;
      const payment = data?.payment;
      const eventType = body?.type;

      const isSuccess = payment?.payment_status === 'SUCCESS' || eventType === 'PAYMENT_SUCCESS_WEBHOOK';

      return {
        isValid: true,
        event: eventType,
        order_id: order?.order_id,
        transaction_id: payment?.cf_payment_id?.toString(),
        amount: payment?.payment_amount,
        currency: payment?.payment_currency || 'INR',
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
    const appId = config.key_id;
    const secretKey = config.key_secret;
    const orderId = params.order_id;

    const baseUrl = this.getEndpoint(config.mode);
    const refundId = `REF_${Date.now()}`;

    try {
      const response = await fetch(`${baseUrl}/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refund_id: refundId,
          refund_amount: params.amount,
          refund_note: params.reason || 'Customer refund requested'
        })
      });

      const data: any = await response.json();
      const isSuccess = data?.refund_status === 'SUCCESS' || data?.refund_status === 'PENDING';

      return {
        success: isSuccess,
        refund_id: data?.cf_refund_id?.toString() || refundId,
        amount: params.amount,
        status: data?.refund_status === 'SUCCESS' ? 'PROCESSED' : 'PENDING',
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
