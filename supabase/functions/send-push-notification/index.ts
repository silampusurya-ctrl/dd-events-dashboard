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
    const { title, body, url, audienceRole, departments, staffProfileId, subscriberName } = await req.json();

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    webpush.setVapidDetails("mailto:noreply@ddevents.app", vapidPublicKey, vapidPrivateKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;

    // Department names and staff names are typed/stored in several places
    // (profile form, older role field, subscription row), so compare them
    // case- and whitespace-insensitively instead of by exact string.
    const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const wantedDepartments = (Array.isArray(departments) ? departments : []).map(norm).filter(Boolean);

    const targetedSubs = (subs || []).filter((sub) => {
      if (audienceRole && norm(sub.subscriber_role) !== norm(audienceRole)) return false;
      if (norm(audienceRole) !== "staff") return true;

      // Any of the identity hints may be missing on a given subscription row
      // (older rows have no staff_profile_id, a renamed profile no longer
      // matches by name). Treat them as alternatives, not as a priority chain -
      // the previous version returned false on the first hint it could check,
      // so an approval alert never fell back to the staff member's name.
      const matchers: boolean[] = [];
      if (wantedDepartments.length > 0) {
        const subDepartment = norm(sub.subscriber_department);
        // Rows written before the department column existed still have it
        // empty. A device we cannot classify is better over-notified than
        // never notified, and it re-classifies itself the next time that
        // staff member opens the portal.
        matchers.push(!subDepartment || wantedDepartments.includes(subDepartment));
      }
      if (staffProfileId) {
        matchers.push(!!sub.staff_profile_id && String(sub.staff_profile_id) === String(staffProfileId));
      }
      if (subscriberName) {
        matchers.push(!!sub.subscriber_name && norm(sub.subscriber_name) === norm(subscriberName));
      }

      // No hints at all means "every staff device".
      return matchers.length === 0 || matchers.some(Boolean);
    });

    const payload = JSON.stringify({
      title: title || "DD Events",
      body: body || "You have a new update.",
      url: url || "./",
    });

    let sent = 0;
    let removed = 0;

    await Promise.all(targetedSubs.map(async (sub) => {
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

    return new Response(JSON.stringify({ sent, removed, total: targetedSubs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
