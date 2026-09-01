import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, RefreshCw } from 'lucide-react';
import { parseAIQuery } from '../lib/aiInsights';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: number;
  role: 'user' | 'bot';
  text: string;
  isTyping?: boolean;
}

interface AskAIProps {
  visits: any[];
  customers: any[];
  products: any[];
  expenses?: any[];
  appointments?: any[];
}

const SUGGESTIONS = [
  // Revenue & Finance
  'Revenue this month?',
  'Average bill value?',
  'Cash vs UPI breakdown?',
  'What is our total profit?',
  'Show me discounts given',
  'What was our highest expense?',
  // Customers
  'Top 5 customers?',
  'Customer lifetime value?',
  'Churned customers list?',
  'Birthday this month?',
  'New customers this week?',
  'How many returning customers?',
  'Who spent the most this month?',
  // Services & Products
  'Best service this month?',
  'Service revenue breakdown?',
  'Top product sales?',
  'Which products are low stock?',
  // Staff
  'Top performing staff?',
  'Staff visit count this month?',
  // Trends
  'Last 6 months revenue trend?',
  'Busiest month ever?',
  'What is our busiest day of the week?',
  'Which day generates the most revenue?',
  // Health & Appointments
  'At risk customers?',
  'Who visited today?',
  'How many appointments today?',
  'Total value of upcoming appointments?',
];

// Helper to get N random items from an array
const getRandomSuggestions = (n: number) => {
  const shuffled = [...SUGGESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
};

export default function AskAI({ visits, customers, products, expenses = [], appointments = [] }: AskAIProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'bot',
      text: 'Hi! Ask me anything about your salon — revenue, top customers, low stock, and more.',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);

  const shuffleSuggestions = () => {
    setCurrentSuggestions(getRandomSuggestions(3));
  };

  useEffect(() => {
    if (open) {
      shuffleSuggestions();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isTyping) return;
    setInput('');

    const userMsg: Message = { id: Date.now(), role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate a short "thinking" delay for feel
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

    const answer = parseAIQuery(q, { visits, customers, products, expenses });
    setIsTyping(false);
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: answer }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
    inputRef.current?.focus();
  };

  // Render markdown bold (**text**) in bot messages
  const renderBotText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <button
        className="ask-ai-btn"
        onClick={() => setOpen(o => !o)}
        title="Ask AI"
        id="ask-ai-toggle-btn"
      >
        <div className="ask-ai-btn-ring" />
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Sparkles className="w-5 h-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="ai-chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="ai-chat-header">
              <div className="ai-icon-wrap">
                <Bot className="w-4 h-4" style={{ color: '#E6C27A' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">TEN11 AI</p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(200, 157, 60, 0.5)' }}>
                  Powered by your data
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="ai-chat-messages custom-scrollbar">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}
                >
                  {msg.role === 'bot' ? renderBotText(msg.text) : msg.text}
                </div>
              ))}

              {isTyping && (
                <div className="ai-msg-bot" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.65rem 0.9rem' }}>
                  <span className="ai-typing-dot" />
                  <span className="ai-typing-dot" />
                  <span className="ai-typing-dot" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions — randomized and shuffleable */}
            <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Try asking:</span>
              {currentSuggestions.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    background: 'rgba(200, 157, 60, 0.08)',
                    border: '1px solid rgba(200, 157, 60, 0.18)',
                    color: 'var(--gold-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200, 157, 60, 0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200, 157, 60, 0.08)')}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={shuffleSuggestions}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = 'var(--gold-light)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                }}
                title="Shuffle suggestions"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Input */}
            <div className="ai-chat-input-wrap">
              <input
                ref={inputRef}
                className="ai-chat-input"
                placeholder="Ask anything about your salon..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                id="ask-ai-input"
              />
              <button
                className="ai-chat-send"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                title="Send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
