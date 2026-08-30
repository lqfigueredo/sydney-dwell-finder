import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logAppError } from "@/lib/admin.functions";

/**
 * Records unhandled client errors so admins can review them on /admin/health.
 * Only signed-in sessions report (the endpoint requires auth).
 */
export function ErrorLogger() {
  const log = useServerFn(logAppError);

  useEffect(() => {
    let last = "";
    const send = async (message: string, detail?: string) => {
      if (!message || message === last) return;
      last = message;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        await log({
          data: {
            message,
            detail: detail ?? "",
            route: window.location.pathname,
            source: "client",
          },
        });
      } catch {
        /* never let logging break the app */
      }
    };

    const onError = (e: ErrorEvent) => void send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      void send(
        e.reason instanceof Error ? e.reason.message : String(e.reason),
        e.reason instanceof Error ? e.reason.stack : undefined,
      );

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [log]);

  return null;
}
