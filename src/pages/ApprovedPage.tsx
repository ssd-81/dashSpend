import { useCallback, useMemo, useState } from "react";
import { listApproved } from "../api/endpoints";
import { useSession } from "../store/session";
import RequestList from "../components/RequestList";
import { Input } from "../components/ui";
import { currentPeriod } from "../lib/date";

export default function ApprovedPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState(currentPeriod());
  const dept = user?.department_id ?? undefined;

  const loader = useCallback(
    (page: number) => listApproved({ period: period || undefined, department_id: dept, page, page_size: 25 }),
    [period, dept],
  );

  const emptyBody = useMemo(
    () => "Approved requests for this period will appear here once managers sign them off.",
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Approved</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Archive of approved reimbursements{user?.department_name ? ` in ${user.department_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="approved-period" className="text-[13px] font-medium text-ink-2">
            Period
          </label>
          <Input
            id="approved-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          />
        </div>
      </div>
      <RequestList loader={loader} emptyTitle="Nothing approved here yet" emptyBody={emptyBody} showEmployee />
    </div>
  );
}