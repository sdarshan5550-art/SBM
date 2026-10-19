declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    // Check if script element already exists
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onPaymentFailed?: (response: {
    error: {
      code: string;
      description: string;
      source: string;
      step: string;
      reason: string;
      metadata: {
        order_id: string;
        payment_id: string;
      };
    };
  }) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    animation?: boolean;
    backdropclose?: boolean;
  };
}

export const openRazorpayCheckout = async (options: RazorpayOptions): Promise<any> => {
  // Sandbox dev simulation when using demo order ID
  if (options.order_id.startsWith('order_sim_')) {
    console.log('[Payment Sandbox] Simulating payment checkout for demo order:', options.order_id);
    await new Promise(r => setTimeout(r, 600));
    options.handler({
      razorpay_order_id: options.order_id,
      razorpay_payment_id: `pay_sim_${Date.now()}`,
      razorpay_signature: `sig_sim_${Date.now()}`
    });
    return { simulated: true };
  }

  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    throw new Error('Could not load Razorpay payment gateway checkout interface. Please check your internet connection and try again.');
  }

  const { onPaymentFailed, ...rzpOptions } = options;
  const rzp = new window.Razorpay(rzpOptions);

  if (onPaymentFailed) {
    rzp.on('payment.failed', (response: any) => {
      onPaymentFailed(response);
    });
  }

  rzp.open();
  return rzp;
};
