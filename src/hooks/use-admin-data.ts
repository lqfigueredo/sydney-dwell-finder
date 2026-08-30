import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminSnapshot, runAdminAction } from "@/lib/admin.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";

export function useAdminData() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const snapshotFn = useServerFn(getAdminSnapshot);
  const actionFn = useServerFn(runAdminAction);

  const snapshot = useQuery({
    queryKey: ["admin-snapshot"],
    enabled: isAdmin,
    queryFn: () => snapshotFn({}),
  });

  const act = useMutation({
    mutationFn: (input: Parameters<typeof actionFn>[0]["data"]) => actionFn({ data: input }),
    onSuccess: () => {
      toast.success("Done");
      void qc.invalidateQueries({ queryKey: ["admin-snapshot"] });
      void qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
      void qc.invalidateQueries({ queryKey: ["admin-listing-photos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { isAdmin, loading, snapshot, act, data: snapshot.data };
}
