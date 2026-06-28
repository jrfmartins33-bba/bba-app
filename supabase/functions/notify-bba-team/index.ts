import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { title, body } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SECRET_KEY") ?? ""
  );

  const { data: team, error } = await supabase
    .from("profiles")
    .select("id, metadata")
    .eq("role", "bba_admin");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { headers: corsHeaders, status: 400 });
  }

  const tickets = await Promise.all(
    (team ?? [])
      .map((member) => member.metadata?.expo_push_token)
      .filter(Boolean)
      .map((expoPushToken) =>
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: expoPushToken,
            title,
            body,
            sound: "default"
          })
        })
      )
  );

  return Response.json(
    { ok: true, sent: tickets.filter((ticket) => ticket.ok).length },
    { headers: corsHeaders }
  );
});
