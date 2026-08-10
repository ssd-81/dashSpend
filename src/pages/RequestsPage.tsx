import { useMemo } from "react";
import { listRequests } from "../api/endpoints";
import { currentPeriod, formatPeriod } from "../lib/date";
import RequestList from "../components/RequestList";

export default function RequestsPage() {
  const period = currentPeriod();

  const loader = useMemo(() => (page: number) => listRequests({ page, page_size: 25 }), []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">My requests</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Submit your draft expenses for a month from the Expenses screen.
        </p>
      </div>
      <RequestList
        loader={loader}
        emptyTitle="No requests yet"
        emptyBody={`You have not submitted anything for ${formatPeriod(period)}. Add expenses, then use the submit button on the Expenses screen.`}
      />
    </div>
  );
}