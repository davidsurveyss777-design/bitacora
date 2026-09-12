// Cloudflare Worker — handles /api/chat.
// Keeps GROQ_API_KEY out of the browser entirely.
//
// Set it in: Cloudflare dashboard → your project → Settings →
// Variables and Secrets (the RUNTIME section, not under "Build") →
// GROQ_API_KEY

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

function buildSystemPrompt(tasks) {
  let prompt =
    "Eres el asistente personal de Pol, un desarrollador independiente. Respondes en español, de forma directa, cercana y útil, sin rodeos ni relleno. Puedes recibir imágenes y archivos de texto adjuntos por el usuario.";

  if (Array.isArray(tasks) && tasks.length > 0) {
    const pending = tasks.filter((t) => !t.done).map((t) => `- ${t.text}`);
    const done = tasks.filter((t) => t.done).map((t) => `- ${t.text}`);
    prompt += "\n\nEstas son las tareas actuales de Pol (puedes referirte a ellas si te pregunta):";
    prompt += pending.length ? `\nPendientes:\n${pending.join("\n")}` : "\nPendientes: ninguna.";
    if (done.length) prompt += `\nCompletadas:\n${done.join("\n")}`;
  }

  return prompt;
}

async function handleChat(request, env) {
  try {
    const { messages, tasks } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "missing messages" }), { status: 400 });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        max_tokens: 1000,
        messages: [
          { role: "system", content: buildSystemPrompt(tasks) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "groq_error", detail: errText }), { status: 502 });
    }

    const data = await res.json();
    const rawReply = data.choices?.[0]?.message?.content || "";
    const reply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "server_error", detail: String(err) }), { status: 500 });
  }
}