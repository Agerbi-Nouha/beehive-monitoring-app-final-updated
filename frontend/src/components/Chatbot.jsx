import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// Quick suggestion buttons per page
const suggestionsByPage = {
  dashboard: [
    { label: "Today's overview", prompt: "overview" },
    { label: 'Why is a hive unhealthy?', prompt: 'why health low' },
    { label: 'List active alerts', prompt: 'list alerts' },
  ],
  hives: [
    { label: 'Lowest battery hive', prompt: 'lowest battery' },
    { label: 'Hives needing inspection', prompt: 'needs inspection' },
    { label: 'Compare two hives', prompt: 'compare Hive_02 and Hive_05' },
  ],
  history: [
    { label: 'Summarize last 24h', prompt: 'summarize last 24h' },
    { label: 'Detect weight drops', prompt: 'weight drops' },
    { label: 'Explain health dips', prompt: 'explain dips' },
  ],
  alerts: [
    { label: 'Explain this alert', prompt: 'explain alert' },
    { label: 'What should I do?', prompt: 'action for alert' },
    { label: 'Prioritize alerts', prompt: 'prioritize alerts' },
  ],
  sensors: [
    { label: 'Is this value normal?', prompt: 'is 37.8 normal' },
    { label: 'Show thresholds', prompt: 'humidity thresholds' },
    { label: 'Explain sensor status', prompt: 'explain status' },
  ],
};

// Determine page context from URL path
function getPageContext() {
  const path = window.location.pathname;
  if (path.startsWith('/hives')) return 'hives';
  if (path.startsWith('/map')) return 'map';
  if (path.startsWith('/history')) return 'history';
  if (path.startsWith('/alerts')) return 'alerts';
  if (path.startsWith('/sensors')) return 'sensors';
  if (path.startsWith('/export')) return 'export';
  if (path.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function Chatbot() {
  const [messages, setMessages] = useState([{
    sender: 'bot',
    text: 'Hello! I am your Hive Assistant. How can I help you?',
  }]);
  const [input, setInput] = useState('');
  const [hives, setHives] = useState([]);
  const [events, setEvents] = useState([]);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [hivesRes, eventsRes] = await Promise.all([
          axios.get('/api/hives'),
          axios.get('/api/events'),
        ]);
        setHives(hivesRes.data);
        setEvents(eventsRes.data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
    // Subscribe to sensor_update via socket to refresh hives
    const socket = io();
    socket.on('sensor_update', () => {
      axios.get('/api/hives').then((res) => setHives(res.data));
      axios.get('/api/events').then((res) => setEvents(res.data));
    });
    return () => socket.disconnect();
  }, []);

  // Handle user sending a message
  const sendMessage = async (prompt) => {
    const userMessage = { sender: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    // Generate reply
    const reply = await generateReply(prompt);
    setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
  };

  // Rule-based reply generation
  async function generateReply(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes('overview')) {
      const total = hives.length;
      const live = hives.filter((h) => h.status === 'LIVE').length;
      const simulated = hives.filter((h) => h.status === 'SIMULATED').length;
      const offline = hives.filter((h) => h.status === 'OFFLINE').length;
      const avgHealth = hives.length ? Math.round(hives.reduce((sum, h) => sum + h.health, 0) / hives.length) : 0;
      const activeAlerts = events.filter((e) => e.severity !== 'OK').length;
      const dangerAlerts = events.filter((e) => e.severity === 'DANGER').length;
      const warningAlerts = events.filter((e) => e.severity === 'WARNING').length;
      return `Today's status: ${total} total hives — ${live} Live, ${simulated} Simulated, ${offline} Offline. Average health is ${avgHealth}%. Active alerts: ${activeAlerts} (${warningAlerts} Warning, ${dangerAlerts} Danger).`;
    }
    if (p.includes('lowest battery')) {
      if (!hives.length) return 'No hive data available yet.';
      const sorted = [...hives].sort((a, b) => a.values.battery - b.values.battery);
      const hive = sorted[0];
      return `${hive.hiveId} has the lowest battery at ${hive.values.battery}% (${hive.statuses.battery}).`;
    }
    if (p.includes('why') && p.includes('health')) {
      // extract hive id if provided
      const match = prompt.match(/hive[_\s]*([0-9]+)/i);
      const hiveId = match ? `Hive_${String(match[1]).padStart(2, '0')}` : hives[0]?.hiveId;
      const hive = hives.find((h) => h.hiveId === hiveId);
      if (!hive) return 'Hive not found.';
      const reasons = [];
      if (hive.statuses.temperature !== 'OK') reasons.push(`temperature (${hive.values.temperature}°C — ${hive.statuses.temperature})`);
      if (hive.statuses.humidity !== 'OK') reasons.push(`humidity (${hive.values.humidity}% — ${hive.statuses.humidity})`);
      if (hive.statuses.weight !== 'OK') reasons.push(`weight (${hive.values.weight} kg — ${hive.statuses.weight})`);
      if (hive.statuses.battery !== 'OK') reasons.push(`battery (${hive.values.battery}% — ${hive.statuses.battery})`);
      if (!reasons.length) return `${hiveId} is healthy.`;
      return `${hiveId} health is reduced mainly due to ${reasons.join(' and ')}.`;
    }
    if (p.includes('health score') && p.includes('calculated')) {
      return 'The health score is calculated using a weighted model: Temperature (40%), Humidity (25%), Weight (20%), and Battery (15%). Each parameter is evaluated based on its distance from optimal ranges.';
    }
    if (p.includes('humidity thresholds')) {
      return 'Humidity thresholds: Normal 50–70% RH, Warning 40–50 or 70–80, Danger below 40 or above 80.';
    }
    if (p.includes('temperature thresholds')) {
      return 'Temperature thresholds: Normal 32–36°C, Warning 30–32°C or 36–38°C, Danger below 30°C or above 38°C.';
    }
    if (p.includes('compare')) {
      // expect prompt like 'compare Hive_02 and Hive_05'
      const ids = prompt.match(/Hive_\d+/g);
      if (ids && ids.length === 2) {
        const [id1, id2] = ids;
        const h1 = hives.find((h) => h.hiveId === id1);
        const h2 = hives.find((h) => h.hiveId === id2);
        if (!h1 || !h2) return 'One of the hives not found.';
        return `${h1.hiveId}: Health ${h1.health}% (${h1.statuses.temperature}, Temp ${h1.values.temperature}°C, Humidity ${h1.values.humidity}%, Battery ${h1.values.battery}%). ${h2.hiveId}: Health ${h2.health}% (${h2.statuses.temperature}, Temp ${h2.values.temperature}°C, Humidity ${h2.values.humidity}%, Battery ${h2.values.battery}%).`;
      }
    }
    if (p.includes('weight drops')) {
      // find weight drop events
      const drops = events.filter((e) => e.type === 'WEIGHT_DROP');
      if (!drops.length) return 'No weight drops detected recently.';
      const msg = drops
        .slice(0, 3)
        .map((d) => `${d.hiveId} dropped weight at ${new Date(d.createdAt).toLocaleString()}`)
        .join('; ');
      return `Weight drops detected: ${msg}.`;
    }
    if (p.includes('list alerts') || p.includes('active alerts')) {
      const active = events.filter((e) => e.severity !== 'OK');
      if (!active.length) return 'There are no active alerts.';
      return active.map((e) => `${e.hiveId}: ${e.type} (${e.severity})`).join('; ');
    }
    return "I'm sorry, I didn't understand that. Please try a different question.";
  }

  const page = getPageContext();
  const suggestions = suggestionsByPage[page] || [];

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white shadow-lg rounded-lg flex flex-col h-96">
      <div className="flex-1 p-2 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-2 ${msg.sender === 'bot' ? '' : 'text-right'}`}>
            <div className={`inline-block px-3 py-2 rounded-lg ${msg.sender === 'bot' ? 'bg-gray-100 text-gray-800' : 'bg-accent text-white'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-2">
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {suggestions.map((sug, i) => (
              <button
                key={i}
                className="text-sm bg-gray-200 rounded-full px-2 py-1 hover:bg-gray-300"
                onClick={() => sendMessage(sug.prompt)}
              >
                {sug.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Ask something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                sendMessage(input.trim());
                setInput('');
              }
            }}
          />
          <button
            className="bg-accent text-white px-3 py-1 rounded"
            onClick={() => {
              if (input.trim()) {
                sendMessage(input.trim());
                setInput('');
              }
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;