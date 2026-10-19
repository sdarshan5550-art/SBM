import { PropertyCode } from '../../../src/types';

export type PaymentGatewayProviderType = 'razorpay' | 'phonepe' | 'cashfree' | 'stripe';

export interface PropertyGatewayConfig {
  property_code: PropertyCode;
  property_name: string;
  provider: PaymentGatewayProviderType;
  merchant_id: string;
  bank_account_name: string;
  settlement_account_number: string;
  is_configured: boolean;
  mode: 'test' | 'live' | 'unconfigured';
  key_id: string; // Public API key / client ID
  key_secret?: string; // Private key (never sent to client)
  webhook_secret?: string; // Webhook secret
  webhook_url: string;
  masked_key_id: string;
  has_secret: boolean;
  has_webhook_secret: boolean;
}

export interface CreateOrderParams {
  amountInPaise: number; // in smallest currency unit (paise for INR, cents for USD)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  customer?: {
    name: string;
    email: string;
    contact: string;
  };
  returnUrl?: string;
}

export interface PaymentOrderResult {
  order_id: string;
  provider: PaymentGatewayProviderType;
  amount: number; // amount in paise
  currency: string;
  key_id: string;
  property_code: PropertyCode;
  property_name: string;
  bank_account_name: string;
  settlement_account_hint: string;
  merchant_id?: string;
  payment_url?: string;
  raw_response?: any;
}

export interface VerifyPaymentParams {
  order_id: string;
  transaction_id: string; // payment_id
  signature?: string;
  property_code: PropertyCode;
  raw_payload?: any;
}

export interface VerifyPaymentResult {
  isValid: boolean;
  transaction_id: string;
  order_id: string;
  amount?: number;
  currency?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error?: string;
  method?: string;
  raw_response?: any;
}

export interface WebhookVerifyParams {
  rawBody: string;
  signatureHeader: string;
  property_code: PropertyCode;
}

export interface WebhookVerifyResult {
  isValid: boolean;
  event?: string;
  order_id?: string;
  transaction_id?: string;
  amount?: number;
  currency?: string;
  status?: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'OTHER';
  error?: string;
}

export interface RefundParams {
  transaction_id: string;
  order_id?: string;
  amount: number; // in INR
  reason?: string;
  property_code: PropertyCode;
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  amount: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  error?: string;
  raw_response?: any;
}

export interface IPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProviderType;
  createOrder(config: PropertyGatewayConfig, params: CreateOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(config: PropertyGatewayConfig, params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  verifyWebhook(config: PropertyGatewayConfig, params: WebhookVerifyParams): Promise<WebhookVerifyResult>;
  processRefund(config: PropertyGatewayConfig, params: RefundParams): Promise<RefundResult>;
}
