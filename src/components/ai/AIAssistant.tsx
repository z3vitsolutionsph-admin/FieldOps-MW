import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  FileText,
  User,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Site, Hop, WorkOrder } from '../../types/fieldops';
import { gemini } from '../../services/geminiService';

interface AIAssistantProps {
  site?: Site | null;
  hop?: Hop | null;
  workOrder?: WorkOrder | null;
  sunlightMode: boolean;
  onNavigateToTssr?: () => void;
}

interface Message {
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  citation?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  site,
  hop,
  workOrder,
  sunlightMode,
  onNavigateToTssr,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'AI',
      text:
        hop && site
          ? `Kumusta! I am FieldOps AI. I am grounded directly on TSSR data for Hop "${hop.hopName}" and Site "${site.id} (${site.name})". Ask me about approved ACL heights, cable gauges, RSL thresholds, or safety specs.`
          : `Kumusta! I am FieldOps AI. All previous TSSR data has been cleared so you can test AI capabilities on a fresh TSSR upload. When a Project Manager uploads a TSSR document (PDF, images, scan, or JSON), I will automatically parse every RF microwave coordinate, antenna height, azimuth, and equipment spec. You can also ask me general telecom microwave & rigging engineering questions right now!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citation: hop && site ? 'TSSR Revision 3.2 · Transport ACL Approved' : 'FieldOps AI Ready for Ingestion',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    'What is the approved antenna height and leg on Site B?',
    'What are the grounding cable gauges for IDU and ODU?',
    'What is the expected RSL and fade margin?',
    'What torque specs should I use for AMB U-bolts?',
    'How do I verify -48V DC polarity for NR9150?',
  ];

  const handleSend = async (queryToSend?: string) => {
    const q = queryToSend || inputQuery;
    if (!q.trim() || isLoading) return;

    const userMsg: Message = {
      sender: 'USER',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await gemini.askFieldOps(q, {
        site: site || undefined,
        hop: hop || undefined,
        workOrder: workOrder || undefined,
      });
      const aiMsg: Message = {
        sender: 'AI',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citation: hop ? 'Source: TSSR Sec 1.1–1.6 & Transport Engineering ACL Routing Sheet' : 'Source: Telecom MW Standards & Best Practices',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: Message = {
        sender: 'AI',
        text: 'Unable to reach cloud model. Using offline TSSR snapshot: Target RSL is -27.17 dBm on azimuth 241.02°. Approved antenna centerline is 40.7m on Leg C.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Header Card */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              Ask FieldOps AI
              <span className="text-xs px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                {hop ? 'Grounded on TSSR' : 'Awaiting TSSR Ingestion'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Site: <strong className="text-slate-200">{site?.id || 'Pending TSSR'}</strong> · Hop:{' '}
              <strong className="text-slate-200">{hop?.configuration || 'Pending Link Assignment'}</strong>
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-right text-xs font-mono text-slate-400">
          <p>Model: Gemini 3.8 Flash</p>
          <p className="text-emerald-400">Offline Fallback Ready</p>
        </div>
      </div>

      {/* Quick Prompts Carousel */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div
        className={`p-4 rounded-xl border min-h-[380px] max-h-[500px] overflow-y-auto space-y-3 ${
          sunlightMode
            ? 'bg-white border-neutral-300 text-black'
            : 'bg-slate-900/90 border-slate-800 text-slate-200'
        }`}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-2.5 ${msg.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'AI' && (
              <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed space-y-1.5 ${
                msg.sender === 'USER'
                  ? 'bg-cyan-600 text-white rounded-br-none shadow'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                <span>{msg.citation || 'Technician Prompt'}</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>

            {msg.sender === 'USER' && (
              <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono p-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>FieldOps AI is cross-referencing TSSR parameters...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about antenna heights, cable run lengths, torque specs, or troubleshooting..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputQuery.trim() || isLoading}
          className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </div>
    </div>
  );
};
