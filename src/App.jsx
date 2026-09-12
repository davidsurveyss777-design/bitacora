import { useState, useEffect, useRef } from "react";
import { MessageSquare, CheckSquare, StickyNote, Send, Plus, Trash2, Loader2, Paperclip, X } from "lucide-react";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "tareas", label: "Tareas", icon: CheckSquare },
  { id: "notas", label: "Notas", icon: StickyNote },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Sigues despierto";
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [tab, setTab] = useState("chat");

  const [chat, setChat] = useState(() => loadLocal("bitacora-chat", []));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null); // { kind: "image"|"text", name, dataUrl?, text? }
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [tasks, setTasks] = useState(() => loadLocal("bitacora-tasks", []));
  const [taskDraft, setTaskDraft] = useState("");

  const [notes, setNotes] = useState(() => loadLocal("bitacora-notes", []));
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => { localStorage.setItem("bitacora-tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("bitacora-notes", JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem("bitacora-chat", JSON.stringify(chat)); }, [chat]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, sending]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type.startsWith("image/")) {
      if (file.size > 4 * 1024 * 1024) {
        alert("La imagen pesa demasiado (máximo 4MB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setAttachment({ kind: "image", name: file.name, dataUrl: reader.result });
      reader.readAsDataURL(file);
      return;
    }

    const textTypes = [".txt", ".md", ".csv", ".json", ".js", ".jsx", ".ts", ".py", ".html", ".css"];
    const isTextFile = textTypes.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = () => setAttachment({ kind: "text", name: file.name, text: reader.result });
      reader.readAsText(file);
      return;
    }

    alert("Ese tipo de archivo no está soportado todavía — de momento admito imágenes y archivos de texto (.txt, .md, .csv, .json, código).");
  }

  async function sendMessage() {
    const text = draft.trim();
    if ((!text && !attachment) || sending) return;

    let content = text;
    if (attachment) {
      const parts = [];
      if (text) parts.push({ type: "text", text });
      if (attachment.kind === "image") {
        parts.push({ type: "text", text: `[Imagen adjunta: ${attachment.name}]` });
        parts.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
      } else {
        parts.push({ type: "text", text: `[Archivo adjunto: ${attachment.name}]\n\n${attachment.text}` });
      }
      content = parts;
    }

    const nextChat = [...chat, { role: "user", content, _attachmentName: attachment?.name, _attachmentKind: attachment?.kind }];
    setChat(nextChat);
    setDraft("");
    setAttachment(null);
    setSending(true);
    try {
      // Calls our own backend function (worker/index.js) which holds
      // the Groq API key server-side. Never call the Groq API directly
      // from the browser — that would expose the key.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextChat.map(({ role, content }) => ({ role, content })),
          tasks,
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      const reply = data.reply || "No he podido responder a eso.";
      setChat((c) => [...c, { role: "assistant", content: reply }]);
    } catch {
      setChat((c) => [...c, { role: "assistant", content: "Se ha cortado la conexión. Inténtalo de nuevo." }]);
    } finally {
      setSending(false);
    }
  }

  function addTask() {
    const text = taskDraft.trim();
    if (!text) return;
    setTasks((t) => [...t, { id: Date.now(), text, done: false }]);
    setTaskDraft("");
  }
  function toggleTask(id) { setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); }
  function removeTask(id) { setTasks((t) => t.filter((x) => x.id !== id)); }

  function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((n) => [{ id: Date.now(), text, date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" }) }, ...n]);
    setNoteDraft("");
  }
  function removeNote(id) { setNotes((n) => n.filter((x) => x.id !== id)); }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="bit-sans w-screen h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className="flex flex-col justify-between w-52 shrink-0 p-5" style={{ backgroundColor: "var(--surface)", borderRight: "1px solid var(--border)" }}>
        <div>
          <div className="bit-serif text-xl mb-1" style={{ color: "var(--ink)" }}>Bitácora</div>
          <div className="bit-mono text-xs mb-8" style={{ color: "var(--ink-dim)" }}>
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: tab === id ? "var(--surface-2)" : "transparent",
                  color: tab === id ? "var(--ink)" : "var(--ink-dim)",
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="bit-mono text-xs leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          {tasks.length > 0 && <div>{doneCount}/{tasks.length} tareas hechas</div>}
          {notes.length > 0 && <div>{notes.length} nota{notes.length !== 1 ? "s" : ""}</div>}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: "var(--bg)" }}>
        {tab === "chat" && (
          <>
            <div className="px-6 pt-5 pb-3">
              <div className="bit-serif text-lg" style={{ color: "var(--ink)" }}>{greeting()}, Pol</div>
            </div>
            <div className="flex-1 overflow-y-auto bit-scroll px-6 flex flex-col gap-3">
              {chat.length === 0 && (
                <div className="text-sm mt-2" style={{ color: "var(--ink-dim)" }}>
                  Escribe algo para empezar. Todo queda guardado en este dispositivo.
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`max-w-[75%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${m.role === "user" ? "self-end" : "self-start"}`}
                  style={{
                    backgroundColor: m.role === "user" ? "var(--accent)" : "var(--surface)",
                    color: m.role === "user" ? "#1B2733" : "var(--ink)",
                  }}
                >
                  {Array.isArray(m.content) ? (
                    <div className="flex flex-col gap-2">
                      {m.content.filter((p) => p.type === "image_url").map((p, j) => (
                        <img key={j} src={p.image_url.url} alt="adjunto" className="rounded-md max-w-full max-h-40 object-cover" />
                      ))}
                      {m.content.filter((p) => p.type === "text").map((p, j) => <div key={j}>{p.text}</div>)}
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              ))}
              {sending && (
                <div className="self-start flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink-dim)" }}>
                  <Loader2 size={14} className="animate-spin" /> escribiendo
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {attachment && (
              <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--surface)", color: "var(--ink-dim)" }}>
                <Paperclip size={12} />
                <span className="flex-1 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)}><X size={13} /></button>
              </div>
            )}
            <div className="p-4 flex gap-2 items-end">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.txt,.md,.csv,.json,.js,.jsx,.ts,.py,.html,.css" />
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-lg shrink-0" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <Paperclip size={16} color="var(--ink-dim)" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Escribe un mensaje..."
                rows={1}
                className="flex-1 resize-none px-3.5 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
              />
              <button onClick={sendMessage} disabled={sending || (!draft.trim() && !attachment)} className="p-2.5 rounded-lg shrink-0 disabled:opacity-40" style={{ backgroundColor: "var(--accent)" }}>
                <Send size={16} color="#1B2733" />
              </button>
            </div>
          </>
        )}

        {tab === "tareas" && (
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <div className="bit-serif text-lg mb-4" style={{ color: "var(--ink)" }}>Tareas</div>
            <div className="flex gap-2 mb-4">
              <input
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Añadir tarea..."
                className="flex-1 px-3.5 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
              />
              <button onClick={addTask} className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--accent)" }}>
                <Plus size={16} color="#1B2733" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bit-scroll flex flex-col gap-1.5">
              {tasks.length === 0 && <div className="text-sm" style={{ color: "var(--ink-dim)" }}>Sin tareas pendientes.</div>}
              {tasks.map((t) => (
                <div key={t.id} className="group flex items-center gap-3 px-3.5 py-2.5 rounded-lg" style={{ backgroundColor: "var(--surface)" }}>
                  <button
                    onClick={() => toggleTask(t.id)}
                    className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                    style={{ border: `1.5px solid ${t.done ? "var(--sage)" : "var(--ink-dim)"}`, backgroundColor: t.done ? "var(--sage)" : "transparent" }}
                  >
                    {t.done && <CheckSquare size={10} color="#1B2733" />}
                  </button>
                  <span className="text-sm flex-1" style={{ color: t.done ? "var(--ink-dim)" : "var(--ink)", textDecoration: t.done ? "line-through" : "none" }}>
                    {t.text}
                  </span>
                  <button onClick={() => removeTask(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} color="var(--ink-dim)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notas" && (
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <div className="bit-serif text-lg mb-4" style={{ color: "var(--ink)" }}>Notas</div>
            <div className="flex gap-2 mb-4">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Nota rápida..."
                className="flex-1 px-3.5 py-2.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
              />
              <button onClick={addNote} className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--accent)" }}>
                <Plus size={16} color="#1B2733" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bit-scroll flex flex-col gap-2">
              {notes.length === 0 && <div className="text-sm" style={{ color: "var(--ink-dim)" }}>Sin notas todavía.</div>}
              {notes.map((n) => (
                <div key={n.id} className="group px-3.5 py-3 rounded-lg" style={{ backgroundColor: "var(--surface)" }}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm" style={{ color: "var(--ink)" }}>{n.text}</span>
                    <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Trash2 size={13} color="var(--ink-dim)" />
                    </button>
                  </div>
                  <div className="bit-mono text-xs mt-1.5" style={{ color: "var(--ink-dim)" }}>{n.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
