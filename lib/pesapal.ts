const API_BASE = {
  sandbox: "https://cybqa.pesapal.com/pesapalv3/api",
  live: "https://pay.pesapal.com/v3/api",
} as const;

type PesapalEnvironment = keyof typeof API_BASE;

type RegisterIpnPayload = {
  url: string;
  ipnNotificationType?: "POST" | "GET";
};

export type BillingAddressInput = {
  emailAddress: string;
  phoneNumber: string;
  countryCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  zipCode?: string;
};

export type SubmitOrderInput = {
  merchantReference: string;
  currency: string;
  amount: number;
  description: string;
  callbackUrl: string;
  notificationId: string;
  branch?: string;
  billingAddress: BillingAddressInput;
  accountNumber?: string;
  subscriptionDetails?: SubscriptionDetailsInput;
};

export type SubscriptionFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type SubscriptionDetailsInput = {
  startDate: string;
  endDate: string;
  frequency: SubscriptionFrequency;
};

function ensureEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not defined. Update your .env.local file.`);
  }
  return value.trim();
}

function getEnvironment(): PesapalEnvironment {
  const env = (process.env.PESAPAL_ENVIRONMENT ?? "sandbox").toLowerCase();
  if (env !== "sandbox" && env !== "live") {
    throw new Error(`Unsupported PESAPAL_ENVIRONMENT: ${env}`);
  }
  return env;
}

function getBaseUrl() {
  return API_BASE[getEnvironment()];
}

async function requestJson(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });
  const text = await response.text();
  const payload = tryParseJson(text);
  if (!response.ok) {
    const fallbackMessage = text || response.statusText;
    const errorMessage = extractError(payload) ?? fallbackMessage;
    throw new Error(`Pesapal request failed (${response.status}): ${errorMessage}`);
  }
  return payload;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("error" in payload) {
    const errorField = (payload as Record<string, unknown>).error;
    if (typeof errorField === "string") {
      return errorField;
    }
    if (errorField && typeof errorField === "object") {
      const nested = errorField as Record<string, unknown>;
      return (nested.message as string) || (nested.code as string) || null;
    }
  }

  if ("message" in payload && typeof (payload as Record<string, unknown>).message === "string") {
    return (payload as Record<string, unknown>).message as string;
  }

  return null;
}

export async function requestAccessToken() {
  const consumerKey = ensureEnv(process.env.PESAPAL_CONSUMER_KEY, "PESAPAL_CONSUMER_KEY");
  const consumerSecret = ensureEnv(process.env.PESAPAL_CONSUMER_SECRET, "PESAPAL_CONSUMER_SECRET");
  const url = `${getBaseUrl()}/Auth/RequestToken`;
  return requestJson(url, {
    method: "POST",
    headers: defaultHeaders(),
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    }),
  });
}

function defaultHeaders(token?: string) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function withToken<T>(callback: (token: string) => Promise<T>) {
  const tokenPayload = await requestAccessToken();
  if (!tokenPayload?.token) {
    throw new Error("Pesapal did not return an access token");
  }
  return callback(tokenPayload.token as string);
}

export async function registerIpn(payload: RegisterIpnPayload) {
  if (!payload.url) {
    throw new Error("An IPN URL is required");
  }
  return withToken(async (token) =>
    requestJson(`${getBaseUrl()}/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: defaultHeaders(token),
      body: JSON.stringify({
        url: payload.url,
        ipn_notification_type: payload.ipnNotificationType ?? "POST",
      }),
    }),
  );
}

export async function listIpns() {
  return withToken(async (token) =>
    requestJson(`${getBaseUrl()}/URLSetup/GetIpnList`, {
      method: "GET",
      headers: defaultHeaders(token),
    }),
  );
}

function mapBillingAddress(input: BillingAddressInput) {
  return {
    email_address: input.emailAddress,
    phone_number: input.phoneNumber,
    country_code: input.countryCode,
    first_name: input.firstName,
    middle_name: input.middleName ?? "",
    last_name: input.lastName,
    line_1: input.line1 ?? "",
    line_2: input.line2 ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    postal_code: input.postalCode ?? "",
    zip_code: input.zipCode ?? "",
  };
}

export async function submitOrderRequest(payload: SubmitOrderInput) {
  const body: Record<string, unknown> = {
    id: payload.merchantReference,
    currency: payload.currency,
    amount: payload.amount,
    description: payload.description,
    callback_url: payload.callbackUrl,
    notification_id: payload.notificationId,
    branch: payload.branch ?? "",
    billing_address: mapBillingAddress(payload.billingAddress),
  };

  if (payload.accountNumber) {
    body.account_number = payload.accountNumber;
  }

  if (payload.subscriptionDetails) {
    body.subscription_details = mapSubscriptionDetails(payload.subscriptionDetails);
  }

  return withToken(async (token) =>
    requestJson(`${getBaseUrl()}/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: defaultHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

function mapSubscriptionDetails(details: SubscriptionDetailsInput) {
  return {
    start_date: details.startDate,
    end_date: details.endDate,
    frequency: details.frequency,
  };
}

export async function getTransactionStatus(orderTrackingId: string) {
  if (!orderTrackingId) {
    throw new Error("OrderTrackingId is required");
  }
  return withToken(async (token) =>
    requestJson(`${getBaseUrl()}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
      method: "GET",
      headers: defaultHeaders(token),
    }),
  );
}

export async function cancelOrder(orderTrackingId: string) {
  if (!orderTrackingId) {
    throw new Error("order_tracking_id is required");
  }
  return withToken(async (token) =>
    requestJson(`${getBaseUrl()}/Transactions/CancelOrder`, {
      method: "POST",
      headers: defaultHeaders(token),
      body: JSON.stringify({
        order_tracking_id: orderTrackingId,
      }),
    }),
  );
}
