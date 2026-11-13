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
import { EasebuzzAdapter } from './adapters/easebuzzAdapter';
import { PhonePeAdapter } from './adapters/phonepeAdapter';
import { RazorpayAdapter } from './adapters/razorpayAdapter';
import { CashfreeAdapter } from './adapters/cashfreeAdapter';
import { StripeAdapter } from './adapters/stripeAdapter';
import { db } from '../../db';

export function sanitizeEnv(val: string | undefined | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Normalizes provider string safely without collapsing Razorpay into PhonePe or vice-versa.
 * If raw is unset, falls back strictly to the specified default provider for that property.
 */
export function normalizeProvider(
  raw: string | undefined,
  defaultProvider: PaymentGatewayProviderType
): PaymentGatewayProviderType {
  if (!raw) return defaultProvider;
  const lower = raw.toLowerCase().trim();
  if (lower === 'easebuzz' || lower.includes('easebuzz')) return 'easebuzz';
  if (lower === 'phonepe' || lower.includes('phonepe')) return 'phonepe';
  if (lower === 'razorpay' || lower.includes('razorpay')) return 'razorpay';
  if (lower === 'cashfree' || lower.includes('cashfree')) return 'cashfree';
  if (lower === 'stripe' || lower.includes('stripe')) return 'stripe';
  return defaultProvider;
}

export class PaymentGatewayRegistry {
  private adapters: Map<PaymentGatewayProviderType, IPaymentGatewayAdapter> = new Map();

  constructor() {
    this.registerAdapter(new EasebuzzAdapter());
    this.registerAdapter(new PhonePeAdapter());
    this.registerAdapter(new RazorpayAdapter());
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

  public normalizePropertyCode(raw: string | undefined): PropertyCode {
    const lower = (raw || '').toLowerCase().trim();
    if (lower === 'sbm2' || lower === 'sbm-guest-house' || lower === 'prop-sbm-guesthouse' || lower.includes('guest')) {
      return 'sbm-guest-house';
    }
    return 'sbm-hotel';
  }

  /**
   * Retrieves server-side configuration for a property:
   * SBM1 (SBM Hotel) -> Easebuzz (Standard Hosted Checkout)
   * SBM2 (SBM 2 Guest House) -> PhonePe (Standard Checkout SDK)
   *
   * Merging:
   * 1. Environment variables (highest priority for secrets)
   * 2. Database persisted gateway configurations
   *
   * No hardcoded default credentials or fake settlement account numbers are used.
   */
  public getPropertyConfig(propertyCode: string): PropertyGatewayConfig {
    const normalizedCode = this.normalizePropertyCode(propertyCode);
    const isSBM1 = normalizedCode === 'sbm-hotel';
    const appUrl = sanitizeEnv(process.env.APP_URL) || 'https://sbmhotel.com';

    // Check DB for any admin-configured gateway settings
    const dbConfigs = db.getPropertyGatewayConfigs?.() || {};
    const dbConfig = dbConfigs[normalizedCode] || {};

    if (isSBM1) {
      // SBM 1: SBM Hotel -> EASEBUZZ Hosted Checkout ONLY
      const provider: PaymentGatewayProviderType = 'easebuzz';

      // Easebuzz Merchant Key
      const keyId =
        sanitizeEnv(process.env.SBM1_GATEWAY_KEY_ID) ||
        sanitizeEnv(process.env.SBM1_EASEBUZZ_KEY) ||
        dbConfig.key_id ||
        '';

      // Easebuzz Merchant Salt
      const keySecret =
        sanitizeEnv(process.env.SBM1_GATEWAY_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM1_EASEBUZZ_SALT) ||
        dbConfig.key_secret ||
        '';

      const easebuzzEnvRaw = (
        sanitizeEnv(process.env.SBM1_EASEBUZZ_ENV) ||
        dbConfig.easebuzz_env ||
        'live'
      ).toLowerCase();
      const easebuzzEnv: 'test' | 'prod' | 'live' =
        easebuzzEnvRaw === 'test' ? 'test' : 'live';

      const webhookSecret =
        sanitizeEnv(process.env.SBM1_GATEWAY_WEBHOOK_SECRET) ||
        dbConfig.webhook_secret ||
        '';

      const merchantId =
        sanitizeEnv(process.env.SBM1_MERCHANT_ID) ||
        dbConfig.merchant_id ||
        keyId ||
        'sbm-hotel-merchant';

      const bankAccountName =
        sanitizeEnv(process.env.SBM1_BANK_ACCOUNT_NAME) ||
        dbConfig.bank_account_name ||
        'SBM Hotel Salasar Current A/C';

      const settlementAccountNumber =
        sanitizeEnv(process.env.SBM1_SETTLEMENT_ACCOUNT_NUMBER) ||
        dbConfig.settlement_account_number ||
        '';

      const isConfigured = Boolean(keyId && keySecret);
      const mode: 'test' | 'live' | 'unconfigured' = isConfigured
        ? (easebuzzEnv === 'live' ? 'live' : 'test')
        : 'unconfigured';

      const maskedKeyId = keyId && keyId.length > 8
        ? `${keyId.substring(0, 6)}...${keyId.substring(keyId.length - 4)}`
        : (keyId || 'NOT CONFIGURED');

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
        client_id: keyId,
        client_secret: keySecret,
        client_version: 1,
        easebuzz_env: easebuzzEnv,
        webhook_secret: webhookSecret,
        webhook_url: `${appUrl}/api/payments/easebuzz/callback`,
        masked_key_id: maskedKeyId,
        has_secret: Boolean(keySecret),
        has_webhook_secret: Boolean(webhookSecret)
      };
    } else {
      // SBM 2: SBM Guest House -> PHONEPE Standard Checkout ONLY
      const provider: PaymentGatewayProviderType = 'phonepe';

      // PhonePe Client ID / Key ID
      const keyId =
        sanitizeEnv(process.env.SBM2_GATEWAY_KEY_ID) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_CLIENT_ID) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_KEY_ID) ||
        dbConfig.key_id ||
        '';

      // PhonePe Client Secret / Key Secret
      const keySecret =
        sanitizeEnv(process.env.SBM2_GATEWAY_KEY_SECRET) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_CLIENT_SECRET) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_KEY_SECRET) ||
        dbConfig.key_secret ||
        '';

      const webhookSecret =
        sanitizeEnv(process.env.SBM2_GATEWAY_WEBHOOK_SECRET) ||
        dbConfig.webhook_secret ||
        '';

      const webhookUsername =
        sanitizeEnv(process.env.SBM2_PHONEPE_WEBHOOK_USERNAME) ||
        dbConfig.webhook_username ||
        '';

      const webhookPassword =
        sanitizeEnv(process.env.SBM2_PHONEPE_WEBHOOK_PASSWORD) ||
        dbConfig.webhook_password ||
        '';

      const clientVersionRaw =
        sanitizeEnv(process.env.SBM2_PHONEPE_CLIENT_VERSION) ||
        (dbConfig.client_version ? String(dbConfig.client_version) : '1');
      const clientVersion = parseInt(clientVersionRaw, 10) || 1;

      const merchantId =
        sanitizeEnv(process.env.SBM2_MERCHANT_ID) ||
        sanitizeEnv(process.env.SBM2_PHONEPE_MERCHANT_ID) ||
        dbConfig.merchant_id ||
        keyId ||
        'sbm-guest-house-merchant';

      const bankAccountName =
        sanitizeEnv(process.env.SBM2_BANK_ACCOUNT_NAME) ||
        dbConfig.bank_account_name ||
        'SBM 2 Guest House Current A/C';

      const settlementAccountNumber =
        sanitizeEnv(process.env.SBM2_SETTLEMENT_ACCOUNT_NUMBER) ||
        dbConfig.settlement_account_number ||
        '';

      const explicitPhonepeEnv =
        sanitizeEnv(process.env.SBM2_PHONEPE_ENV) ||
        sanitizeEnv(process.env.PHONEPE_ENV);

      const phonepeEnv: 'SANDBOX' | 'PRODUCTION' = (
        explicitPhonepeEnv
          ? (explicitPhonepeEnv.toUpperCase() === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION')
          : (dbConfig.phonepe_env
              ? (dbConfig.phonepe_env.toUpperCase() === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION')
              : 'PRODUCTION')
      );

      const isConfigured = Boolean(keyId && keySecret);
      const mode: 'test' | 'live' | 'unconfigured' = isConfigured
        ? (phonepeEnv === 'PRODUCTION' ? 'live' : 'test')
        : 'unconfigured';

      const maskedKeyId = keyId && keyId.length > 8
        ? `${keyId.substring(0, 6)}...${keyId.substring(keyId.length - 4)}`
        : (keyId || 'NOT CONFIGURED');

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
        client_id: keyId,
        client_secret: keySecret,
        client_version: clientVersion,
        phonepe_env: phonepeEnv,
        webhook_secret: webhookSecret,
        webhook_username: webhookUsername,
        webhook_password: webhookPassword,
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
    signatureHeader: string,
    options?: {
      authorizationHeader?: string;
      headers?: Record<string, string | string[] | undefined>;
      rawBodyString?: string;
    }
  ): Promise<WebhookVerifyResult> {
    const config = this.getPropertyConfig(propertyCode);
    const adapter = this.getAdapter(config.provider);
    return adapter.verifyWebhook(config, {
      rawBody,
      rawBodyString: options?.rawBodyString || rawBody,
      signatureHeader,
      authorizationHeader: options?.authorizationHeader,
      headers: options?.headers,
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
      console.log(`   Configured:       ${cfg.is_configured ? 'YES' : 'NO'}`);
      console.log(`   Public Key:       ${cfg.masked_key_id}`);
      console.log(`   Secret Status:    ${cfg.has_secret ? 'PRESENT' : 'MISSING'}`);
      console.log(`   Webhook/Callback: ${cfg.webhook_url}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

export const paymentGatewayRegistry = new PaymentGatewayRegistry();
