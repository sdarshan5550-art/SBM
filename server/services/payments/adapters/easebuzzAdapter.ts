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

export class EasebuzzAdapter implements IPaymentGatewayAdapter {
  public readonly provider: PaymentGatewayProviderType = 'easebuzz';

  /**
   * Determine official Easebuzz base endpoint based on property configuration
   */
  private getBaseUrl(config: PropertyGatewayConfig): string {
    const isLive =
      config.easebuzz_env === 'prod' ||
      config.easebuzz_env === 'live' ||
      config.mode === 'live' ||
      process.env.SBM1_EASEBUZZ_ENV === 'prod' ||
      process.env.SBM1_EASEBUZZ_ENV === 'live' ||
      process.env.SBM1_EASEBUZZ_ENV === 'production';

    return isLive ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in';
  }

  /**
   * Generate SHA-512 Hash for Payment Initiation (initiateLink)
   * Formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
   */
  public generateInitiateHash(data: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
    salt: string;
  }): string {
    const hashString = [
      data.key,
      data.txnid,
      data.amount,
      data.productinfo,
      data.firstname,
      data.email,
      data.udf1 || '',
      data.udf2 || '',
      data.udf3 || '',
      data.udf4 || '',
      data.udf5 || '',
      data.udf6 || '',
      data.udf7 || '',
      data.udf8 || '',
      data.udf9 || '',
      data.udf10 || '',
      data.salt
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Verify Reverse SHA-512 Hash for Easebuzz Callbacks & Webhooks
   * Formula: salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
   */
  public verifyResponseHash(data: any, salt: string): boolean {
    if (!data || !data.hash) return false;

    const hashString = [
      salt,
      data.status || '',
      data.udf10 || '',
      data.udf9 || '',
      data.udf8 || '',
      data.udf7 || '',
      data.udf6 || '',
      data.udf5 || '',
      data.udf4 || '',
      data.udf3 || '',
      data.udf2 || '',
      data.udf1 || '',
      data.email || '',
      data.firstname || '',
      data.productinfo || '',
      data.amount || '',
      data.txnid || '',
      data.key || ''
    ].join('|');

    const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
    const receivedHash = (data.hash || '').toLowerCase();

    return expectedHash === receivedHash;
  }

  /**
   * Generate SHA-512 Hash for Transaction Retrieve API
   * Formula: key|txnid|salt
   */
  public generateRetrieveHash(key: string, txnid: string, salt: string): string {
    const hashString = `${key}|${txnid}|${salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Generate SHA-512 Hash for Refund API
   * Formula: key|merchant_refund_id|easebuzz_id|refund_amount|salt
   */
  public generateRefundHash(data: {
    key: string;
    merchantRefundId: string;
    easebuzzId: string;
    refundAmount: string;
    salt: string;
  }): string {
    const hashString = `${data.key}|${data.merchantRefundId}|${data.easebuzzId}|${data.refundAmount}|${data.salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * 1. Create Order / Payment Initiation
   * Calls Easebuzz POST /payment/initiateLink and returns hosted checkout payment_url
   */
  public async createOrder(
    config: PropertyGatewayConfig,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const key = config.key_id;
    const salt = config.key_secret;

    if (!key || !salt) {
      throw new Error(
        `Easebuzz credentials missing for ${config.property_name} (${config.property_code}). ` +
        `Please configure SBM1_GATEWAY_KEY_ID (Merchant Key) and SBM1_GATEWAY_KEY_SECRET (Merchant Salt).`
      );
    }

    const baseUrl = this.getBaseUrl(config);
    const amountInRupees = (params.amountInPaise / 100).toFixed(2);
    // Sanitize receipt to alphanumeric for txnid
    const cleanReceipt = params.receipt.replace(/[^A-Za-z0-9]/g, '');
    const txnid = `EZ_${cleanReceipt}_${Date.now()}`.slice(0, 36);

    const rawName = (params.customer?.name || 'Devotee').trim();
    const firstname = rawName.split(' ')[0].replace(/[^A-Za-z]/g, '') || 'Devotee';
    const email = (params.customer?.email || 'guest@sbmhotel.com').trim().toLowerCase();
    const phone = (params.customer?.contact || '9876543210').trim().replace(/\D/g, '').slice(-10) || '9876543210';
    const productinfo = `Booking ${params.receipt}`.slice(0, 50);

    const appUrl = process.env.APP_URL || 'https://sbmhotel.com';
    const surl = `${appUrl}/api/payments/easebuzz/callback`;
    const furl = `${appUrl}/api/payments/easebuzz/callback`;

    const udf1 = params.receipt; // booking number
    const udf2 = config.property_code; // property code
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';

    const hash = this.generateInitiateHash({
      key,
      txnid,
      amount: amountInRupees,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      salt
    });

    console.log(
      `[Easebuzz Hosted Checkout - ${config.property_code}] Initiating: txnid=${txnid}, amount=₹${amountInRupees}, mode=${config.mode || 'test'}, endpoint=${baseUrl}/payment/initiateLink`
    );

    const formParams = new URLSearchParams();
    formParams.append('key', key);
    formParams.append('txnid', txnid);
    formParams.append('amount', amountInRupees);
    formParams.append('productinfo', productinfo);
    formParams.append('firstname', firstname);
    formParams.append('phone', phone);
    formParams.append('email', email);
    formParams.append('surl', surl);
    formParams.append('furl', furl);
    formParams.append('hash', hash);
    formParams.append('udf1', udf1);
    formParams.append('udf2', udf2);
    formParams.append('udf3', udf3);
    formParams.append('udf4', udf4);
    formParams.append('udf5', udf5);

    try {
      const response = await fetch(`${baseUrl}/payment/initiateLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formParams.toString()
      });

      if (!response.ok) {
        throw new Error(`Easebuzz HTTP error: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();

      if (resJson.status === 1 && resJson.data) {
        const accessKey = resJson.data;
        const hostedCheckoutUrl = `${baseUrl}/pay/${accessKey}`;

        console.log(
          `[Easebuzz Hosted Checkout - ${config.property_code}] Order Created Successfully: txnid=${txnid}, access_key=[REDACTED]`
        );

        return {
          order_id: txnid,
          provider: 'easebuzz',
          amount: params.amountInPaise,
          currency: 'INR',
          key_id: key,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name || 'SBM Hotel Current A/C',
          settlement_account_hint: config.bank_account_name || 'SBM Hotel Current A/C',
          merchant_id: key,
          payment_url: hostedCheckoutUrl,
          raw_response: { status: 1, access_key: accessKey, txnid }
        };
      }

      const errorMessage = typeof resJson.data === 'string'
        ? resJson.data
        : (resJson.error_desc || resJson.msg || JSON.stringify(resJson));

      throw new Error(`Easebuzz Payment Initiation Failed: ${errorMessage}`);
    } catch (err: any) {
      console.error(`[Easebuzz Payment Initiation Error - ${config.property_code}]`, err.message || err);

      // Simulation mode strictly controlled by ALLOW_PAYMENT_SIMULATION
      if (process.env.NODE_ENV !== 'production' && !['live', 'prod', 'production'].includes((config.easebuzz_env || config.mode || process.env.SBM1_EASEBUZZ_ENV || '').toLowerCase()) && process.env.ALLOW_PAYMENT_SIMULATION === 'true') {
        console.warn(`[Easebuzz Simulator - ${config.property_code}] Simulation mode explicitly enabled via ALLOW_PAYMENT_SIMULATION=true.`);
        const simulatedUrl = `${appUrl}/manage-booking?booking_number=${params.receipt}&payment_status=success`;
        return {
          order_id: txnid,
          provider: 'easebuzz',
          amount: params.amountInPaise,
          currency: 'INR',
          key_id: key,
          property_code: config.property_code,
          property_name: config.property_name,
          bank_account_name: config.bank_account_name || 'SBM Hotel Current A/C',
          settlement_account_hint: config.bank_account_name || 'SBM Hotel Current A/C',
          merchant_id: key,
          payment_url: simulatedUrl,
          raw_response: { simulated: true, error: err.message }
        };
      }

      throw new Error(`Easebuzz Payment Initiation Failed (${config.property_name}): ${err.message || 'Payment initiation error'}`);
    }
  }

  /**
   * 2. Verify Payment Status
   * Verifies callback payload signature and/or queries Easebuzz server-side retrieve API
   */
  public async verifyPayment(
    config: PropertyGatewayConfig,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const key = config.key_id;
    const salt = config.key_secret;
    const txnid = params.order_id || params.transaction_id;

    if (!key || !salt) {
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: txnid,
        status: 'FAILED',
        error: `Easebuzz credentials missing for ${config.property_name}.`
      };
    }

    const payload = params.raw_payload;

    // Callback data is never sufficient to confirm a payment. If supplied, first
    // authenticate its response hash, then independently query Easebuzz server-to-server.
    if (payload && payload.hash && !this.verifyResponseHash(payload, salt)) {
      console.warn(`[Easebuzz Verification - ${config.property_code}] Invalid response hash for txnid=${txnid}`);
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: txnid,
        status: 'FAILED',
        error: 'Cryptographic response hash verification failed.'
      };
    }

    const verifiedTxnId = payload?.txnid || txnid;
    if (!verifiedTxnId) {
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: txnid,
        status: 'FAILED',
        error: 'Missing Easebuzz transaction reference.'
      };
    }

    // Case B: Query server-to-server Transaction Retrieve API
    const baseUrl = this.getBaseUrl(config);
    const retrieveHash = this.generateRetrieveHash(key, verifiedTxnId, salt);

    console.log(`[Easebuzz Verification - ${config.property_code}] Querying transaction status for txnid=${verifiedTxnId}`);

    try {
      const formParams = new URLSearchParams();
      formParams.append('key', key);
      formParams.append('txnid', verifiedTxnId);
      formParams.append('hash', retrieveHash);

      const response = await fetch(`${baseUrl}/transaction/v2/retrieve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formParams.toString()
      });

      if (!response.ok) {
        throw new Error(`Easebuzz retrieve HTTP error: ${response.status}`);
      }

      const resJson = await response.json();

      if (resJson && (resJson.status === 1 || resJson.status === true) && (resJson.data || resJson.msg)) {
        const txnData = resJson.data || resJson.msg;
        const status = (txnData.status || '').toLowerCase();
        const isSuccess = status === 'success';
        const easepayid = txnData.easepayid || txnData.bank_ref_num || verifiedTxnId;
        const amount = txnData.amount ? parseFloat(txnData.amount) : undefined;

        return {
          isValid: isSuccess,
          transaction_id: easepayid,
          order_id: txnData.txnid || verifiedTxnId,
          amount,
          currency: 'INR',
          status: isSuccess ? 'SUCCESS' : (status === 'pending' ? 'PENDING' : 'FAILED'),
          method: 'online_easebuzz',
          error: isSuccess ? undefined : (txnData.error_Message || `Payment status: ${status}`),
          raw_response: txnData
        };
      }

      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: txnid,
        status: 'FAILED',
        error: resJson?.error_desc || 'Transaction record not found in Easebuzz system.'
      };
    } catch (err: any) {
      console.error(`[Easebuzz Transaction V2 Error - ${config.property_code}]`, err.message || err);
      return {
        isValid: false,
        transaction_id: params.transaction_id,
        order_id: txnid,
        status: 'FAILED',
        error: err.message || 'Failed to communicate with Easebuzz verification API.'
      };
    }
  }

  /**
   * 3. Verify Server Webhook
   */
  public async verifyWebhook(
    config: PropertyGatewayConfig,
    params: WebhookVerifyParams
  ): Promise<WebhookVerifyResult> {
    const salt = config.key_secret;
    if (!salt) {
      return { isValid: false, error: 'Merchant Salt not configured.' };
    }

    try {
      const data = typeof params.rawBody === 'string'
        ? (params.rawBody.startsWith('{') ? JSON.parse(params.rawBody) : Object.fromEntries(new URLSearchParams(params.rawBody)))
        : params.rawBody;

      const isHashValid = this.verifyResponseHash(data, salt);
      if (!isHashValid) {
        console.warn(`[Easebuzz Webhook - ${config.property_code}] Webhook hash mismatch.`);
        return { isValid: false, error: 'Cryptographic hash mismatch.' };
      }

      const status = (data.status || '').toLowerCase();
      const amount = data.amount ? parseFloat(data.amount) : undefined;

      return {
        isValid: true,
        event: `payment.${status}`,
        order_id: data.txnid,
        transaction_id: data.easepayid || data.txnid,
        amount,
        currency: 'INR',
        status: status === 'success' ? 'SUCCESS' : (status === 'failure' ? 'FAILED' : 'OTHER')
      };
    } catch (err: any) {
      console.error(`[Easebuzz Webhook Error - ${config.property_code}]`, err.message || err);
      return { isValid: false, error: err.message || 'Invalid webhook payload format.' };
    }
  }

  /**
   * 4. Process Refund
   */
  public async processRefund(
    config: PropertyGatewayConfig,
    params: RefundParams
  ): Promise<RefundResult> {
    const key = config.key_id;
    const salt = config.key_secret;

    if (!key || !salt) {
      return {
        success: false,
        amount: params.amount,
        status: 'FAILED',
        error: 'Easebuzz credentials not configured for refund.'
      };
    }

    const baseUrl = this.getBaseUrl(config);
    const merchantRefundId = `REF_${params.property_code}_${Date.now()}`;
    const refundAmount = params.amount.toFixed(2);
    const easebuzzId = params.transaction_id;

    const hash = this.generateRefundHash({
      key,
      merchantRefundId,
      easebuzzId,
      refundAmount,
      salt
    });

    try {
      const formParams = new URLSearchParams();
      formParams.append('key', key);
      formParams.append('merchant_refund_id', merchantRefundId);
      formParams.append('easebuzz_id', easebuzzId);
      formParams.append('refund_amount', refundAmount);
      formParams.append('hash', hash);

      const response = await fetch(`${baseUrl}/transaction/v1/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formParams.toString()
      });

      const resJson = await response.json();
      const isSuccess = resJson.status === true || resJson.status === 1;

      return {
        success: isSuccess,
        refund_id: resJson.refund_id || merchantRefundId,
        amount: params.amount,
        status: isSuccess ? 'PROCESSED' : 'FAILED',
        error: isSuccess ? undefined : (resJson.msg || resJson.data || 'Refund rejected by Easebuzz'),
        raw_response: resJson
      };
    } catch (err: any) {
      console.error(`[Easebuzz Refund Error - ${config.property_code}]`, err.message || err);
      return {
        success: false,
        amount: params.amount,
        status: 'FAILED',
        error: err.message || 'Refund network error'
      };
    }
  }
}
