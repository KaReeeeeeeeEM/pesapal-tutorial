import { getTransactionStatus } from "@/lib/pesapal";

export const dynamic = "force-dynamic";

type SearchParams = {
  OrderTrackingId?: string;
  OrderMerchantReference?: string;
};

type ResponseProps = {
  searchParams?: SearchParams;
};

export default async function PesapalResponse({ searchParams }: ResponseProps) {
  const trackingId = searchParams?.OrderTrackingId ?? "";
  const merchantReference = searchParams?.OrderMerchantReference ?? "";

  let status: unknown = null;
  let error: string | null = null;

  if (trackingId) {
    try {
      status = await getTransactionStatus(trackingId);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">Pesapal Transaction Response</h1>
        <p className="text-sm text-zinc-600">
          This page mirrors <code>response-page.php</code> and is invoked by Pesapal once a buyer
          completes the hosted checkout.
        </p>
      </header>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">OrderTrackingId</dt>
            <dd className="mt-1 text-zinc-900">{trackingId || "Not provided"}</dd>
          </div>
          <div>
            <dt className="font-semibold">OrderMerchantReference</dt>
            <dd className="mt-1 text-zinc-900">{merchantReference || "Not provided"}</dd>
          </div>
        </dl>
        <pre className="mt-6 max-h-80 overflow-auto rounded-lg bg-zinc-50 p-4 text-xs text-zinc-800">
          {trackingId
            ? error
              ? error
              : JSON.stringify(status, null, 2)
            : "Waiting for Pesapal to append the tracking ID."}
        </pre>
      </div>
    </main>
  );
}
