# Pesapal Test Harness

This project re-implements the PHP sample that lives in `../PesaPal` using Next.js App Router. It exposes the same payment flow but keeps all secrets on the server so you can exercise the Pesapal sandbox (or live) APIs directly from the browser.

## Requirements

Create a `.env.local` file with your Pesapal credentials:

```env
PESAPAL_ENVIRONMENT=sandbox # or live
PESAPAL_CONSUMER_KEY=your-key-here
PESAPAL_CONSUMER_SECRET=your-secret-here
```

The helper UI uses `http://localhost:3000/pesapal/response` as the callback URL and `http://localhost:3000/api/pesapal/ipn` for IPNs by default. Update the form fields if you would like to use publicly accessible tunnels such as ngrok when testing the hosted checkout.

## Available Workflows

Every action calls a dedicated API route under `app/api/pesapal/*`, which keeps your consumer key/secret private. `app/pesapal/response/page.tsx` is the Next.js version of the PHP response page that Pesapal redirects back to after checkout.

## Running Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the toolkit.

1. Register an IPN URL to capture the `notification_id`. This populates the order form automatically.
2. Fill out the billing details and submit an order. Pesapal will return a redirect URL and tracking ID.
3. Use the `OrderTrackingId` to poll the transaction status or visit `/pesapal/response?OrderTrackingId=...`.
4. When Pesapal posts to your IPN URL the payload is appended to `data/pesapal-ipn-log.json`, which the UI can inspect.

### Enabling Subscription-Based Payments

Pesapal requires an `account_number` to identify the customer for recurring billing. In the order form you can:

- Populate *Account Number / Invoice* so the `account_number` field is sent alongside the order.
- Toggle **Enable subscription** to expose date pickers and a frequency selector. We convert the selected dates to the `dd-MM-yyyy` format Pesapal expects and pass them under `subscription_details`.
- Optionally, leave the toggle off so the buyer configures their subscription inside the Pesapal iframe after checkout.

Once Pesapal executes the scheduled payment it triggers an IPN to the same endpoint with `OrderNotificationType=RECURRING`. Fetch the transaction status to read the `subscription_transaction_info` object and reconcile it using your `account_number` / merchant reference.

### Cancelling Pending/Failed Orders

Sometimes a shopper never completes the hosted checkout and you want to revoke the order. Enter the `orderTrackingId` under the **Check Transaction Status / Cancel Order** card and hit **Cancel Order**. The app calls `/api/pesapal/cancel`, which proxies Pesapal’s `Transactions/CancelOrder` endpoint. The API only succeeds for pending or failed transactions and Pesapal only lets you cancel once per order.

Feel free to adapt the UI or the API routes to fit your project’s data models once you have verified the end-to-end payment flow.
