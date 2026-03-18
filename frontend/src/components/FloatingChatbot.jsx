import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { MessageSquare, X, Send, Trash2 } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const STORAGE_OPEN = 'chatbot_open';
const STORAGE_MESSAGES = 'chatbot_messages';

const quickActionsByRoute = [
  { match: /^\/$/, actions: ['Show hive health summary', 'Why is a hive unhealthy?', 'How to reduce alert spam?'] },
  { match: /^\/hives/, actions: ['Open hive details', 'How to add a new hive? (admin)', 'How to connect ESP32?'] },
  { match: /^\/history/, actions: ['Explain chart trends', 'How to change time range?'] },
  { match: /^\/alerts/, actions: ['What does this alert mean?', 'How to resolve an alert? (admin)'] },
  { match: /^\/sensors/, actions: ['What does each sensor do?', 'How to calibrate light (LDR)?', 'Sound sensor normal range?'] },
  { match: /^\/map/, actions: ['Open a hive in Google Maps', 'Why GPS differs from expected?'] },
  { match: /^\/export/, actions: ['Export PDF for last 24h', 'Export alerts only'] },
  { match: /^\/settings/, actions: ['How to set thresholds?', 'Best cooldown value?'] },
  { match: /^\/admin\/devices/, actions: ['How to create device key?', 'ESP32 header x-api-key example'] },
];

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs) {
  localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(msgs.slice(-50)));
}

export default function FloatingChatbot() {
  const { role } = useAuth();
  const location = useLocation();
  const params = useParams();
  const route = location.pathname;

  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_OPEN) === 'true');
  const [messages, setMessages] = useState(() => loadMessages());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_OPEN, open ? 'true' : 'false');
  }, [open]);

  useEffect(() => {
    saveMessages(messages);
    // autoscroll
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, [messages]);

  const quickActions = useMemo(() => {
    const entry = quickActionsByRoute.find((e) => e.match.test(route));
    return entry?.actions || ['Help me use the app', 'Why are alerts triggered?', 'How to connect ESP32 live data?'];
  }, [route]);

  const selectedHiveId = useMemo(() => {
    // If current route is /hives/:hiveId
    if (route.startsWith('/hives/') && route.split('/').length >= 3) {
      return route.split('/')[2];
    }
    return null;
  }, [route]);

  function clearChat() {
    setMessages([]);
    localStorage.removeItem(STORAGE_MESSAGES);
  }

  async function send(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || busy) return;

    const next = [...messages, { role: 'user', content: trimmed, ts: Date.now() }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      const res = await axios.post('/api/chat', {
        message: trimmed,
        hiveId: selectedHiveId,
        context: { route, role, params },
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply, ts: Date.now(), mode: res.data.mode }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I could not reach the chat service. Make sure backend is running and OPENAI_API_KEY is set if you want AI answers.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button
          className="btn btn-primary shadow-soft rounded-full w-12 h-12 p-0 flex items-center justify-center"
          onClick={() => setOpen(true)}
          title="Open assistant"
        >
          <MessageSquare size={20} />
        </button>
      ) : (
        <div className="w-[340px] sm:w-[380px] card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">🐝</div>
              <div>
                <div className="text-sm font-semibold">Hive Assistant</div>
                <div className="text-xs text-muted">Ask anything • role: {role}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost" onClick={clearChat} title="Clear chat">
                <Trash2 size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="h-72 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-sm text-muted">
                Hi! I can explain sensor readings, alerts, and how to connect the ESP32 for live data.
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] bg-accent text-white rounded-2xl px-3 py-2 text-sm'
                      : 'max-w-[80%] bg-black/5 dark:bg-white/5 rounded-2xl px-3 py-2 text-sm'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {busy && <div className="text-xs text-muted">Thinking...</div>}
          </div>

          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-2 pb-2">
              {quickActions.slice(0, 3).map((a) => (
                <button
                  key={a}
                  className="badge bg-accent/10 text-accent hover:bg-accent/15 cursor-pointer"
                  onClick={() => send(a)}
                >
                  {a}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                className="input"
                placeholder="Ask about alerts, sensors, ESP32..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={busy}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
