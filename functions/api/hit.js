export async function onRequestPost({ env }) {
  try {
    const raw = await env.BIDS.get("hits");
    const hits = (parseInt(raw || "0", 10) || 0) + 1;
    await env.BIDS.put("hits", String(hits));
    return new Response(JSON.stringify({ hits }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return new Response(JSON.stringify({ hits: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
