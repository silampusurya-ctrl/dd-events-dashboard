// Supabase Edge Function: sends a Web Push notification to every subscribed
// staff device. Called from the client whenever an event reaches the
// "Advance Pay / Date Booked" stage, so staff get a home-screen notification
// about the newly available booked event.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, body, url } = await req.json();

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    webpush.setVapidDetails("mailto:noreply@ddevents.app", vapidPublicKey, vapidPrivateKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;

    const payload = JSON.stringify({
      title: title || "DD Events",
      body: body || "You have a new update.",
      url: url || "./",
    });

    let sent = 0;
    let removed = 0;

    await Promise.all((subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        sent++;
      } catch (err) {
        // 404/410 means the subscription is dead (uninstalled, permission revoked) - clean it up.
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          removed++;
        } else {
          console.error("Push send failed for", sub.endpoint, err);
        }
      }
    }));

    return new Response(JSON.stringify({ sent, removed, total: (subs || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
