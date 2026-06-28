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

  const { client_id, title, body } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SECRET_KEY") ?? ""
  );

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", client_id)
    .single();

  if (error || !profile?.expo_push_token) {
    return Response.json(
      { ok: false, error: error?.message ?? "Cliente sem token Expo" },
      { headers: corsHeaders, status: 400 }
    );
  }

  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title,
      body,
      sound: "default"
    })
  });

  return Response.json(
    { ok: expoResponse.ok, status: expoResponse.status },
    { headers: corsHeaders }
  );
});
