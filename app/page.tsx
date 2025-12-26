"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { BillingAddressInput, SubmitOrderInput, SubscriptionFrequency } from "@/lib/pesapal";
import type { IpnLogEntry } from "@/lib/ipn-log";

const randomReference = () =>
  `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const emptyBillingAddress: BillingAddressInput = {
  emailAddress: "",
  phoneNumber: "",
  countryCode: "TZ",
  firstName: "",
  middleName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  zipCode: "",
};

const defaultOrder: SubmitOrderInput = {
  merchantReference: randomReference(),
  currency: "TZS",
  amount: 1000,
  description: "Payment description goes here",
  callbackUrl: "",
  notificationId: "",
  branch: "",
  billingAddress: { ...emptyBillingAddress },
  accountNumber: "",
};

type SubscriptionFormState = {
  startDate: string;
  endDate: string;
  frequency: SubscriptionFrequency;
};

const subscriptionDefaults: SubscriptionFormState = {
  startDate: "",
  endDate: "",
  frequency: "MONTHLY",
};

type ActionState<T> = {
  loading: boolean;
  data?: T;
  error?: string;
};

const initialState = { loading: false } satisfies ActionState<unknown>;

export default function Home() {
  const [tokenState, setTokenState] = useState<ActionState<unknown>>(initialState);
  const [ipnUrl, setIpnUrl] = useState("http://localhost:3000/api/pesapal/ipn");
  const [ipnState, setIpnState] = useState<ActionState<unknown>>(initialState);
  const [ipnListState, setIpnListState] = useState<ActionState<unknown>>(initialState);
  const [orderForm, setOrderForm] = useState<SubmitOrderInput>(defaultOrder);
  const [orderState, setOrderState] = useState<ActionState<unknown>>(initialState);
  const [trackingId, setTrackingId] = useState("");
  const [transactionState, setTransactionState] = useState<ActionState<unknown>>(initialState);
  const [cancelState, setCancelState] = useState<ActionState<unknown>>(initialState);
  const [ipnLogs, setIpnLogs] = useState<IpnLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>(subscriptionDefaults);

  useEffect(() => {
    if (!orderForm.callbackUrl && typeof window !== "undefined") {
      setOrderForm((current) => ({
        ...current,
        callbackUrl: `${window.location.origin}/pesapal/response`,
      }));
    }
  }, [orderForm.callbackUrl]);

  useEffect(() => {
    refreshIpnLogs();
  }, []);

  const handleFetchToken = async () => {
    setTokenState({ loading: true });
    try {
      const response = await fetch("/api/pesapal/token", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to fetch token");
      }
      setTokenState({ loading: false, data: payload });
    } catch (error) {
      setTokenState({ loading: false, error: (error as Error).message });
    }
  };

  const handleRegisterIpn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIpnState({ loading: true });
    try {
      const response = await fetch("/api/pesapal/ipns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: ipnUrl,
          ipnNotificationType: "POST",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to register IPN");
      }
      setIpnState({ loading: false, data: payload });
      if (payload?.ipn_id) {
        setOrderForm((current) => ({ ...current, notificationId: payload.ipn_id }));
      }
      await handleListIpns();
    } catch (error) {
      setIpnState({ loading: false, error: (error as Error).message });
    }
  };

  const handleListIpns = async () => {
    setIpnListState({ loading: true });
    try {
      const response = await fetch("/api/pesapal/ipns");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to fetch IPNs");
      }
      setIpnListState({ loading: false, data: payload });
    } catch (error) {
      setIpnListState({ loading: false, error: (error as Error).message });
    }
  };

  const updateOrderField = <T extends keyof SubmitOrderInput>(field: T, value: SubmitOrderInput[T]) => {
    setOrderForm((current) => ({ ...current, [field]: value }));
  };

  const updateBillingField = <T extends keyof BillingAddressInput>(field: T, value: BillingAddressInput[T]) => {
    setOrderForm((current) => ({
      ...current,
      billingAddress: {
        ...current.billingAddress,
        [field]: value,
      },
    }));
  };

  const handleSubmitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderForm.notificationId) {
      setOrderState({ loading: false, error: "Register an IPN first to get the notification ID." });
      return;
    }
    if (subscriptionEnabled) {
      const validationError = validateSubscriptionForm(subscriptionForm);
      if (validationError) {
        setOrderState({ loading: false, error: validationError });
        return;
      }
    }
    setOrderState({ loading: true });
    try {
      const requestPayload = buildSubmitOrderPayload(orderForm, subscriptionEnabled, subscriptionForm);
      const response = await fetch("/api/pesapal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit order");
      }
      setOrderState({ loading: false, data: payload });
      if (payload?.order_tracking_id) {
        setTrackingId(payload.order_tracking_id as string);
      }
    } catch (error) {
      setOrderState({ loading: false, error: (error as Error).message });
    }
  };

  const handleCheckStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackingId) {
      setTransactionState({ loading: false, error: "Enter an OrderTrackingId" });
      return;
    }
    setTransactionState({ loading: true });
    try {
      const response = await fetch(`/api/pesapal/transactions?orderTrackingId=${trackingId}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to fetch transaction status");
      }
      setTransactionState({ loading: false, data: payload });
    } catch (error) {
      setTransactionState({ loading: false, error: (error as Error).message });
    }
  };

  const refreshIpnLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch("/api/pesapal/ipn");
      const payload = await response.json();
      if (Array.isArray(payload)) {
        setIpnLogs([...payload].reverse());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLogsLoading(false);
    }
  };

  const resetReference = () => {
    setOrderForm((current) => ({ ...current, merchantReference: randomReference() }));
  };

  const toggleSubscription = () => {
    setSubscriptionEnabled((current) => !current);
  };

  const updateSubscriptionField = <T extends keyof SubscriptionFormState>(
    field: T,
    value: SubscriptionFormState[T],
  ) => {
    setSubscriptionForm((current) => ({ ...current, [field]: value }));
  };

  const handleCancelOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackingId) {
      setCancelState({ loading: false, error: "Enter an OrderTrackingId" });
      return;
    }
    setCancelState({ loading: true });
    try {
      const response = await fetch("/api/pesapal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderTrackingId: trackingId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to cancel order");
      }
      setCancelState({ loading: false, data: payload });
    } catch (error) {
      setCancelState({ loading: false, error: (error as Error).message });
    }
  };

  return (
    <main className="bg-white mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-zinc-900">Pesapal Payment Toolkit</h1>
        <p className="text-base text-zinc-600">
          Configure your consumer key/secret inside <code>.env.local</code> and use these helpers to
          register IPNs, send orders, and inspect callbacks without touching PHP.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium text-zinc-900">Request Access Token</h2>
            <p className="text-sm text-zinc-500">Mirrors the original acesstoken.php script.</p>
          </div>
          <button
            onClick={handleFetchToken}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={tokenState.loading}
          >
            {tokenState.loading ? "Requesting..." : "Fetch Token"}
          </button>
        </div>
        <JsonViewer payload={tokenState} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium text-zinc-900">Register an IPN URL</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleRegisterIpn}>
          <label className="text-sm font-medium text-zinc-700">
            IPN URL
            <input
              type="url"
              required
              value={ipnUrl}
              onChange={(event) => setIpnUrl(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={ipnState.loading}
            >
              {ipnState.loading ? "Registering..." : "Register IPN"}
            </button>
            <button
              type="button"
              onClick={handleListIpns}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800"
              disabled={ipnListState.loading}
            >
              {ipnListState.loading ? "Loading..." : "Refresh IPN List"}
            </button>
          </div>
        </form>
        <JsonViewer payload={ipnState} title="Registration Response" />
        <JsonViewer payload={ipnListState} title="Registered IPNs" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium text-zinc-900">Submit Order Request</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmitOrder}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Merchant Reference"
              value={orderForm.merchantReference}
              onChange={(value) => updateOrderField("merchantReference", value)}
            />
            <button
              type="button"
              onClick={resetReference}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700"
            >
              Generate Reference
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Amount"
              type="number"
              min="1"
              value={orderForm.amount.toString()}
              onChange={(value) => updateOrderField("amount", Number(value))}
            />
            <Field
              label="Currency"
              value={orderForm.currency}
              onChange={(value) => updateOrderField("currency", value)}
            />
            <Field
              label="Branch"
              value={orderForm.branch ?? ""}
              onChange={(value) => updateOrderField("branch", value)}
            />
          </div>
          <Field
            label="Description"
            value={orderForm.description}
            onChange={(value) => updateOrderField("description", value)}
          />
          <Field
            label="Callback URL"
            type="url"
            value={orderForm.callbackUrl}
            onChange={(value) => updateOrderField("callbackUrl", value)}
          />
          <Field
            label="Notification ID"
            value={orderForm.notificationId}
            onChange={(value) => updateOrderField("notificationId", value)}
            helper="Returned from the Register IPN step"
          />
          <Field
            label="Account Number / Invoice"
            value={orderForm.accountNumber ?? ""}
            onChange={(value) => updateOrderField("accountNumber", value)}
            helper="Optional but required for subscriptions. Helps you identify recurring payments."
          />

          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-semibold text-zinc-800">Billing Address</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field
                label="First Name"
                value={orderForm.billingAddress.firstName}
                onChange={(value) => updateBillingField("firstName", value)}
              />
              <Field
                label="Middle Name"
                value={orderForm.billingAddress.middleName ?? ""}
                onChange={(value) => updateBillingField("middleName", value)}
              />
              <Field
                label="Last Name"
                value={orderForm.billingAddress.lastName}
                onChange={(value) => updateBillingField("lastName", value)}
              />
              <Field
                label="Phone Number"
                value={orderForm.billingAddress.phoneNumber}
                onChange={(value) => updateBillingField("phoneNumber", value)}
              />
              <Field
                label="Email"
                type="email"
                value={orderForm.billingAddress.emailAddress}
                onChange={(value) => updateBillingField("emailAddress", value)}
              />
              <Field
                label="Country Code"
                value={orderForm.billingAddress.countryCode}
                onChange={(value) => updateBillingField("countryCode", value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">Recurring / Subscription</p>
                  <p className="text-xs text-zinc-500">
                    Enable to let Pesapal display the subscription form or pre-fill the details for the
                    buyer.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={subscriptionEnabled}
                    onChange={toggleSubscription}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Enable subscription
                </label>
              </div>
              {subscriptionEnabled ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field
                    label="Start Date"
                    type="date"
                    value={subscriptionForm.startDate}
                    onChange={(value) => updateSubscriptionField("startDate", value)}
                    helper="Pesapal expects dd-MM-yyyy. We'll convert for you."
                  />
                  <Field
                    label="End Date"
                    type="date"
                    value={subscriptionForm.endDate}
                    onChange={(value) => updateSubscriptionField("endDate", value)}
                  />
                  <SelectField
                    label="Frequency"
                    value={subscriptionForm.frequency}
                    onChange={(value) => updateSubscriptionField("frequency", value as SubscriptionFrequency)}
                    options={[
                      { label: "Daily", value: "DAILY" },
                      { label: "Weekly", value: "WEEKLY" },
                      { label: "Monthly", value: "MONTHLY" },
                      { label: "Yearly", value: "YEARLY" },
                    ]}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={orderState.loading}
          >
            {orderState.loading ? "Submitting..." : "Submit Order"}
          </button>
        </form>
        <JsonViewer payload={orderState} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium text-zinc-900">Check Transaction Status / Cancel Order</h2>
        <form className="mt-4 flex flex-col gap-4 md:flex-row" onSubmit={handleCheckStatus}>
          <Field
            label="OrderTrackingId"
            value={trackingId}
            onChange={(value) => setTrackingId(value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={transactionState.loading}
          >
            {transactionState.loading ? "Checking..." : "Check Status"}
          </button>
        </form>
        <JsonViewer payload={transactionState} />
        <form className="mt-6 flex flex-col gap-4 md:flex-row" onSubmit={handleCancelOrder}>
          <Field
            label="OrderTrackingId"
            value={trackingId}
            onChange={(value) => setTrackingId(value)}
            helper="Only pending or failed payments can be cancelled."
          />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={cancelState.loading}
          >
            {cancelState.loading ? "Cancelling..." : "Cancel Order"}
          </button>
        </form>
        <JsonViewer payload={cancelState} title="Cancel Order Response" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-zinc-900">IPN Callback Log</h2>
          <button
            onClick={refreshIpnLogs}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            disabled={logsLoading}
          >
            {logsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {ipnLogs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No callbacks logged yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {ipnLogs.map((entry, index) => (
              <div key={`${entry.receivedAt}-${index}`} className="rounded-lg border border-zinc-100 p-4">
                <p className="text-xs font-semibold text-zinc-500">{new Date(entry.receivedAt).toLocaleString()}</p>
                <pre className="mt-2 overflow-x-auto text-xs text-zinc-800">{entry.raw}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  helper?: string;
  min?: string;
  required?: boolean;
};

function Field({ label, value, onChange, type = "text", helper, min, required }: FieldProps) {
  return (
    <label className="flex flex-1 flex-col text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input
        value={value}
        type={type}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        required={required}
      />
      {helper ? <span className="mt-1 text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}

type SelectFieldOption = { label: string; value: string };

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="flex flex-1 flex-col text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type JsonViewerProps = {
  payload: ActionState<unknown>;
  title?: string;
};

function JsonViewer({ payload, title }: JsonViewerProps) {
  const { data, error, loading } = payload;
  return (
    <div className="mt-4">
      {title ? <p className="text-sm font-semibold text-zinc-700">{title}</p> : null}
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-50 p-4 text-xs text-zinc-800">
        {loading
          ? "Loading..."
          : error
            ? error
            : data
              ? JSON.stringify(data, null, 2)
              : "No data yet."}
      </pre>
    </div>
  );
}

function buildSubmitOrderPayload(
  order: SubmitOrderInput,
  subscriptionEnabled: boolean,
  subscriptionForm: SubscriptionFormState,
) {
  const payload: SubmitOrderInput = {
    ...order,
    accountNumber: order.accountNumber?.trim() ? order.accountNumber.trim() : undefined,
  };

  if (subscriptionEnabled) {
    payload.subscriptionDetails = {
      startDate: formatDateForPesapal(subscriptionForm.startDate),
      endDate: formatDateForPesapal(subscriptionForm.endDate),
      frequency: subscriptionForm.frequency,
    };
  } else {
    delete payload.subscriptionDetails;
  }

  return payload;
}

function validateSubscriptionForm(form: SubscriptionFormState) {
  if (!form.startDate || !form.endDate) {
    return "Start and end dates are required for subscriptions.";
  }
  if (!form.frequency) {
    return "Choose a billing frequency for the subscription.";
  }
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Enter valid dates in YYYY-MM-DD format.";
  }
  if (start > end) {
    return "End date must be after the start date.";
  }
  return null;
}

function formatDateForPesapal(value: string) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}-${month}-${year}`;
}
