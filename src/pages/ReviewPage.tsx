import { useCallback } from "react";
import { listRequests } from "../api/endpoints";
import { useSession } from "../store/session";
import RequestList from "../components/RequestList";

export default function ReviewPage() {
  const { user } = useSession();
  const dept = user?.department_id ?? undefined;

  const loader = useCallback(
    (page: number) =>
      listRequests({ status: "pending", department_id: dept, page, page_size: 25 }),
    [dept],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Review queue</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Pending requests{user?.department_name ? ` in ${user.department_name}` : ""}
        </p>
      </div>
      <RequestList
        loader={loader}
        emptyTitle="Queue is clear"
        emptyBody="No pending requests right now. New submissions from your department appear here."
        showActions
        showEmployee
      />
    </div>
  );
}