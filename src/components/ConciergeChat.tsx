import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Calendar, Users, MapPin, CheckCircle, ArrowRight, Bot, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConciergeChatMessage, PropertyCode, RoomCategoryCode } from '../types';

interface ConciergeChatProps {
  onSelectBookingRoom: (params: {
    propertyCode: PropertyCode;
    roomCode: RoomCategoryCode;
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
  }) => void;
}

export const ConciergeChat: React.FC<ConciergeChatProps> = ({ onSelectBookingRoom }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ConciergeChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Jai Shree Salasar Balaji! Welcome to **SBM Hotel** and **SBM 2 Guest House**.\n\nI am **SBM Concierge**, your 24/7 digital hotel guide. How may I assist your pilgrimage today? You can ask me about room prices, temple distance, or check live room availability for your stay.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage.trim();
    if (!textToSend || loading) return;

    const userMsg: ConciergeChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/concierge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });

      if (!res.ok) throw new Error('Concierge service unavailable');

      const data = await res.json();

      const aiMsg: ConciergeChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.replyText || "I don't have that information available right now. Please contact SBM Hotel for assistance.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        availabilityDetails: data.availabilityDetails,
        recommendation: data.recommendation
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: "I don't have that information available right now. Please contact SBM Hotel directly at **+91 99835 67921** or **+91 98285 00845** for assistance.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleBookHandoff = (item: {
    propertyCode: PropertyCode;
    roomCode: RoomCategoryCode;
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
  }) => {
    setIsOpen(false);
    onSelectBookingRoom(item);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            id="btn-ask-sbm-concierge"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 bg-[#1A1A1A] text-white px-4 py-3 rounded-full shadow-2xl border border-[#C5A059]/40 hover:border-[#C5A059] transition-all group"
          >
            <div className="w-7 h-7 rounded-full bg-[#C5A059] flex items-center justify-center text-white shadow-inner">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <span className="text-xs font-medium tracking-wide font-serif text-[#F3E5AB] group-hover:text-white transition-colors">
              Ask SBM Concierge
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="sbm-concierge-chat-drawer"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[360px] sm:w-[400px] h-[540px] bg-white rounded-2xl shadow-2xl border border-[#C5A059]/30 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1A1A1A] p-4 text-white border-b border-[#C5A059]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#C5A059] flex items-center justify-center text-white shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-sm font-medium text-white tracking-wide">SBM Concierge</h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-emerald-500/30">
                      Live 24/7
                    </span>
                  </div>
                  <p className="text-[10px] text-[#C5A059] font-light">AI Hotel Assistant for Salasar Guests</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-stone-300 hover:text-white transition-colors"
                aria-label="Close Concierge Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Questions Header Bar */}
            <div className="bg-stone-50 border-b border-stone-100 p-2 overflow-x-auto flex gap-1.5 scrollbar-none text-[11px]">
              <button
                onClick={() => handleQuickPrompt('How far is SBM Hotel from Salasar Balaji Temple?')}
                className="whitespace-nowrap bg-white text-stone-700 hover:text-[#C5A059] hover:border-[#C5A059] px-2.5 py-1 rounded-full border border-stone-200 transition-colors shadow-2xs"
              >
                📍 Temple Distance
              </button>
              <button
                onClick={() => handleQuickPrompt('What rooms are available for tomorrow for 2 adults?')}
                className="whitespace-nowrap bg-white text-stone-700 hover:text-[#C5A059] hover:border-[#C5A059] px-2.5 py-1 rounded-full border border-stone-200 transition-colors shadow-2xs"
              >
                🛏 Check Vacancy
              </button>
              <button
                onClick={() => handleQuickPrompt('What is the price of Family Suite and Deluxe Room?')}
                className="whitespace-nowrap bg-white text-stone-700 hover:text-[#C5A059] hover:border-[#C5A059] px-2.5 py-1 rounded-full border border-stone-200 transition-colors shadow-2xs"
              >
                💰 Room Rates
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAF9F6]">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-stone-400">
                      {msg.sender === 'user' ? 'You' : 'SBM Concierge'} • {msg.timestamp}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] text-xs leading-relaxed p-3 rounded-2xl shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-[#1A1A1A] text-white rounded-tr-none'
                        : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-none font-sans'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                    {/* Recommendation Card Handoff */}
                    {msg.recommendation && (
                      <div className="mt-3 bg-stone-50 border border-[#C5A059]/30 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="bg-[#C5A059]/20 text-[#8B6B23] text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                            Recommended Room
                          </span>
                          <span className="text-xs font-bold text-[#1A1A1A]">
                            ₹{msg.recommendation.pricePerNight.toLocaleString('en-IN')}/night
                          </span>
                        </div>
                        <div>
                          <p className="font-serif font-medium text-stone-900 text-sm">{msg.recommendation.roomName}</p>
                          <p className="text-[11px] text-stone-500">{msg.recommendation.propertyName}</p>
                        </div>
                        <p className="text-[10px] text-stone-600 italic">"{msg.recommendation.reason}"</p>
                        <button
                          onClick={() =>
                            handleBookHandoff({
                              propertyCode: msg.recommendation!.propertyCode,
                              roomCode: msg.recommendation!.roomCode
                            })
                          }
                          className="w-full bg-[#C5A059] hover:bg-[#B48E4B] text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                          Select & Book Now <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Live Availability Cards inside chat */}
                    {msg.availabilityDetails && msg.availabilityDetails.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                          Live Room Options
                        </p>
                        <div className="space-y-2">
                          {msg.availabilityDetails.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${
                                item.isAvailable
                                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                                  : 'bg-stone-100 border-stone-200 text-stone-500'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className="block text-stone-900 font-serif font-medium">{item.roomName}</strong>
                                  <span className="text-[10px] text-stone-500">{item.propertyName}</span>
                                </div>
                                <span className="font-bold text-[#C5A059]">
                                  ₹{item.pricePerNight.toLocaleString('en-IN')}/nt
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-stone-600">
                                <span>{item.isAvailable ? `Available (${item.availableRooms} rooms left)` : 'Fully Booked'}</span>
                                {item.isAvailable && (
                                  <button
                                    onClick={() =>
                                      handleBookHandoff({
                                        propertyCode: item.propertyCode,
                                        roomCode: item.roomCode,
                                        checkIn: item.checkIn,
                                        checkOut: item.checkOut,
                                        adults: item.adults,
                                        children: item.children
                                      })
                                    }
                                    className="bg-[#1A1A1A] hover:bg-black text-white px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
                                  >
                                    Book Room
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-stone-400 text-xs py-2 px-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
                  <span>SBM Concierge is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask SBM Concierge a question..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                disabled={loading}
                className="flex-1 text-xs bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#C5A059] focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="w-9 h-9 rounded-xl bg-[#1A1A1A] hover:bg-[#C5A059] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow-xs"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
