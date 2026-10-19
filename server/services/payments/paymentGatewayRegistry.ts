import { PropertyCode } from '../../../src/types';
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
} from './types';
import { RazorpayAdapter } from './adapters/razorpayAdapter';
import { PhonePeAdapter } from './adapters/phonepeAdapter';
import { CashfreeAdapter } from './adapters/cashfreeAdapter';
import { StripeAdapter } from './adapters/stripeAdapter';
import { db } from '../../db';

export function sanitizeEnv(val: string | undefined | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

// Default Test Credentials for sandbox demonstration
const SBM1_DEFAULT_KEY_ID = 'rzp_test_TRDGuSUIMqEArq';
const SBM1_DEFAULT_KEY_SECRET = 'pTQbfu4fvI9VVAUPPx16ROLE';

// SBM 2 has its own secondary test credentials / separate account representation
const SBM2_DEFAULT_KEY_ID = 'rzp_test_SBM2GuestHouseKey';
const SBM2_DEFAULT_KEY_SECRET = 'sbm2SecretKeyLiveDev992';

export class PaymentGatewayRegistry {
  private adapters: Map<PaymentGatewayProviderType, IPaymentGatewayAdapter> = new Map();

  constructor() {
    this.registerAdapter(new RazorpayAdapter());
    this.registerAdapter(new PhonePeAdapter());
    this.registerAdapter(new CashfreeAdapter());
    this.registerAdapter(new StripeAdapter());
  }

  public registerAdapter(adapter: IPaymentGatewayAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  public getAdapter(provider: PaymentGatewayProviderType): IPaymentGatewayAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unsupported payment gateway provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * Retrieves server-side configuration for a property, merging:
   * 1. Environment variables (highest priority for secrets)
   * 2. Database persisted gateway configurations
   * 3. Fallbacks to ensure backwards compatibility with existing RAZORPAY_* variables
   */
  public getPropertyConfig(propertyCode: PropertyCode): PropertyGatewayConfig {
    const isSBM1 = propertyCode === 'sbm-hotel';
    const appUrl = sanitizeEnv(process.env.APP_URL) || 'https://sbmhotel.com';

    // Check DB for any admin-configured gateway settings
    const dbConfigs = db.getPropertyGatewayConfigs?.() || {};
    const dbConfig = dbConfigs[propertyCode] || {};

    if (isSBM1) {
      // SBM 1: SBM Hotel (Primary Property)
      const provider: PaymentGatewayProviderType = (
        sanitizeEnv(process.env.SBM1_PAYMENT_GATEWAY_PROVIDER) ||
        dbConfig.provider ||
        'razorpay'
      ) as PaymentGatewayProviderType;

      let keyId =
        sanitizeEnv(process.env.SBM1_GATEWAY_KEY_ID) ||
        sanitizeEnv(process.env.SBM1_RAZORPAY_KEY_ID) ||
        dbConfig.key_id ||
        sanitizeEnv(process.env.RAZORPAY_KEY_ID) ||
        SBM1_DEFAULT_KEY_ID;

      let keySecret =
        sanitizeEnv(process.env.SBM1_GATEWAY_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM1_RAZORPAY_KEY_SECRET) ||
        dbConfig.key_secret ||
        sanitizeEnv(process.env.RAZORPAY_KEY_SECRET) ||
        SBM1_DEFAULT_KEY_SECRET;

      let webhookSecret =
        sanitizeEnv(process.env.SBM1_GATEWAY_WEBHOOK_SECRET) ||
        sanitizeEnv(process.env.SBM1_RAZORPAY_WEBHOOK_SECRET) ||
        dbConfig.webhook_secret ||
        sanitizeEnv(process.env.RAZORPAY_WEBHOOK_SECRET) ||
        '';

      const merchantId =
        sanitizeEnv(process.env.SBM1_MERCHANT_ID) ||
        dbConfig.merchant_id ||
        'SBM_HOTEL_1_MERCHANT';

      const bankAccountName =
        sanitizeEnv(process.env.SBM1_BANK_ACCOUNT_NAME) ||
        dbConfig.bank_account_name ||
        'SBM Hotel Salasar Current A/C (HDFC Bank)';

      const settlementAccountNumber =
        sanitizeEnv(process.env.SBM1_SETTLEMENT_ACCOUNT_NUMBER) ||
        dbConfig.settlement_account_number ||
        '50200084920101';

      const isConfigured = Boolean(keyId && keySecret);
      let mode: 'test' | 'live' | 'unconfigured' = 'unconfigured';
      if (keyId.startsWith('rzp_test_') || keyId.startsWith('test_') || keyId.includes('sandbox')) {
        mode = 'test';
      } else if (keyId.startsWith('rzp_live_') || keyId.startsWith('live_') || keyId.startsWith('pk_live_')) {
        mode = 'live';
      } else if (isConfigured) {
        mode = 'test';
      }

      const maskedKeyId = keyId && keyId.length > 8
        ? `${keyId.substring(0, 8)}...${keyId.substring(keyId.length - 4)}`
        : (keyId || 'NOT SET');

      return {
        property_code: 'sbm-hotel',
        property_name: 'SBM Hotel',
        provider,
        merchant_id: merchantId,
        bank_account_name: bankAccountName,
        settlement_account_number: settlementAccountNumber,
        is_configured: isConfigured,
        mode,
        key_id: keyId,
        key_secret: keySecret,
        webhook_secret: webhookSecret,
        webhook_url: `${appUrl}/api/payments/webhook/sbm-hotel`,
        masked_key_id: maskedKeyId,
        has_secret: Boolean(keySecret),
        has_webhook_secret: Boolean(webhookSecret)
      };
    } else {
      // SBM 2: SBM Guest House (Secondary Property)
      const provider: PaymentGatewayProviderType = (
        sanitizeEnv(process.env.SBM2_PAYMENT_GATEWAY_PROVIDER) ||
        dbConfig.provider ||
        'razorpay'
      ) as PaymentGatewayProviderType;

      let keyId =
        sanitizeEnv(process.env.SBM2_GATEWAY_KEY_ID) ||
        sanitizeEnv(process.env.SBM2_RAZORPAY_KEY_ID) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_KEY_ID) ||
        sanitizeEnv(process.env.SBM2_CASHFREE_KEY_ID) ||
        dbConfig.key_id ||
        SBM2_DEFAULT_KEY_ID;

      let keySecret =
        sanitizeEnv(process.env.SBM2_GATEWAY_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM2_RAZORPAY_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM2_CASHFREE_KEY_SECRET) ||
        dbConfig.key_secret ||
        SBM2_DEFAULT_KEY_SECRET;

      let webhookSecret =
        sanitizeEnv(process.env.SBM2_GATEWAY_WEBHOOK_SECRET) ||
        sanitizeEnv(process.env.SBM2_RAZORPAY_WEBHOOK_SECRET) ||
        dbConfig.webhook_secret ||
        '';

      const merchantId =
        sanitizeEnv(process.env.SBM2_MERCHANT_ID) ||
        dbConfig.merchant_id ||
        'SBM_GUEST_HOUSE_2_MERCHANT';

      const bankAccountName =
        sanitizeEnv(process.env.SBM2_BANK_ACCOUNT_NAME) ||
        dbConfig.bank_account_name ||
        'SBM 2 Guest House Current A/C (ICICI Bank)';

      const settlementAccountNumber =
        sanitizeEnv(process.env.SBM2_SETTLEMENT_ACCOUNT_NUMBER) ||
        dbConfig.settlement_account_number ||
        '10480500938472';

      const isConfigured = Boolean(keyId && keySecret);
      let mode: 'test' | 'live' | 'unconfigured' = 'unconfigured';
      if (keyId.startsWith('rzp_test_') || keyId.startsWith('test_') || keyId.includes('sandbox') || keyId.includes('Key')) {
        mode = 'test';
      } else if (keyId.startsWith('rzp_live_') || keyId.startsWith('live_') || keyId.startsWith('pk_live_')) {
        mode = 'live';
      } else if (isConfigured) {
        mode = 'test';
      }

      const maskedKeyId = keyId && keyId.length > 8
        ? `${keyId.substring(0, 8)}...${keyId.substring(keyId.length - 4)}`
        : (keyId || 'NOT SET');

      return {
        property_code: 'sbm-guest-house',
        property_name: 'SBM 2 Guest House',
        provider,
        merchant_id: merchantId,
        bank_account_name: bankAccountName,
        settlement_account_number: settlementAccountNumber,
        is_configured: isConfigured,
        mode,
        key_id: keyId,
        key_secret: keySecret,
        webhook_secret: webhookSecret,
        webhook_url: `${appUrl}/api/payments/webhook/sbm-guest-house`,
        masked_key_id: maskedKeyId,
        has_secret: Boolean(keySecret),
        has_webhook_secret: Boolean(webhookSecret)
      };
    }
  }

  /**
   * Safe public configuration without exposing any server-side secret keys
   */
  public getPublicPropertyConfig(propertyCode: PropertyCode): Omit<PropertyGatewayConfig, 'key_secret' | 'webhook_secret'> {
    const full = this.getPropertyConfig(propertyCode);
    const { key_secret, webhook_secret, ...publicCfg } = full;
    return publicCfg;
  }

  public getAllPublicConfigs(): Record<PropertyCode, Omit<PropertyGatewayConfig, 'key_secret' | 'webhook_secret'>> {
    return {
      'sbm-hotel': this.getPublicPropertyConfig('sbm-hotel'),
      'sbm-guest-house': this.getPublicPropertyConfig('sbm-guest-house')
    };
  }

  public updatePropertyConfig(
    propertyCode: PropertyCode,
    updates: Partial<PropertyGatewayConfig>
  ): PropertyGatewayConfig {
    const current = this.getPropertyConfig(propertyCode);
    const merged = {
      ...current,
      ...updates,
      property_code: propertyCode,
      property_name: propertyCode === 'sbm-hotel' ? 'SBM Hotel' : 'SBM 2 Guest House'
    };

    db.updatePropertyGatewayConfig(propertyCode, merged);
    return this.getPropertyConfig(propertyCode);
  }

  /**
   * Create an order routed directly to the property's assigned payment gateway provider
   */
  public async createOrderForProperty(
    propertyCode: PropertyCode,
    params: CreateOrderParams
  ): Promise<PaymentOrderResult> {
    const config = this.getPropertyConfig(propertyCode);
    const adapter = this.getAdapter(config.provider);
    return adapter.createOrder(config, params);
  }

  /**
   * Cryptographically verify payment using the property's assigned gateway secret
   */
  public async verifyPaymentForProperty(
    propertyCode: PropertyCode,
    params: VerifyPaymentParams
  ): Promise<VerifyPaymentResult> {
    const config = this.getPropertyConfig(propertyCode);
    const adapter = this.getAdapter(config.provider);
    return adapter.verifyPayment(config, params);
  }

  /**
   * Verify and process incoming webhooks for a specific property
   */
  public async handleWebhook(
    propertyCode: PropertyCode,
    rawBody: string,
    signatureHeader: string
  ): Promise<WebhookVerifyResult> {
    const config = this.getPropertyConfig(propertyCode);
    const adapter = this.getAdapter(config.provider);
    return adapter.verifyWebhook(config, {
      rawBody,
      signatureHeader,
      property_code: propertyCode
    });
  }

  /**
   * Execute property-aware refund strictly through that property's assigned merchant account
   */
  public async processRefundForProperty(
    propertyCode: PropertyCode,
    params: RefundParams
  ): Promise<RefundResult> {
    const config = this.getPropertyConfig(propertyCode);
    const adapter = this.getAdapter(config.provider);
    return adapter.processRefund(config, params);
  }

  public logStartupDiagnostics(): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' [SBM HOTEL] Multi-Property Payment Gateway System Initialized');
    for (const code of ['sbm-hotel', 'sbm-guest-house'] as PropertyCode[]) {
      const cfg = this.getPropertyConfig(code);
      console.log(` • Property:         ${cfg.property_name} (${cfg.property_code})`);
      console.log(`   Provider:         ${cfg.provider.toUpperCase()} (Mode: ${cfg.mode.toUpperCase()})`);
      console.log(`   Merchant ID:      ${cfg.merchant_id}`);
      console.log(`   Settlement A/C:   ${cfg.bank_account_name}`);
      console.log(`   Public Key:       ${cfg.masked_key_id}`);
      console.log(`   Secret Status:    ${cfg.has_secret ? 'PRESENT' : 'MISSING'}`);
      console.log(`   Webhook URL:      ${cfg.webhook_url}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

export const paymentGatewayRegistry = new PaymentGatewayRegistry();
