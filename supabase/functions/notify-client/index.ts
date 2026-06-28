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

  const { company_id, title, body } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SECRET_KEY") ?? ""
  );

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("company_id", company_id)
    .eq("role", "client");

  const expoPushToken = profiles
    ?.map((profile) => profile.metadata?.expo_push_token)
    .find(Boolean);

  if (error || !expoPushToken) {
    return Response.json(
      { ok: false, error: error?.message ?? "Cliente sem token Expo" },
      { headers: corsHeaders, status: 400 }
    );
  }

  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: expoPushToken,
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
