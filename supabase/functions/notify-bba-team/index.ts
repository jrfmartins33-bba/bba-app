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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: team, error } = await supabase
    .from("profiles")
    .select("id, expo_push_token")
    .eq("plan", "bba_team")
    .not("expo_push_token", "is", null);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { headers: corsHeaders, status: 400 });
  }

  const tickets = await Promise.all(
    (team ?? []).map((member) =>
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: member.expo_push_token,
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
