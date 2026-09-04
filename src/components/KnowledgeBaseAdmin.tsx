import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Edit2, Search, Save, X, RefreshCw, BookOpen, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { KnowledgeItem, KnowledgeCategory } from '../types';

interface KnowledgeBaseAdminProps {
  token: string;
}

const CATEGORIES: KnowledgeCategory[] = [
  'Hotel information',
  'Property information',
  'Room information',
  'Amenities',
  'Policies',
  'FAQs',
  'Contact information',
  'Local information'
];

export const KnowledgeBaseAdmin: React.FC<KnowledgeBaseAdminProps> = ({ token }) => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<KnowledgeCategory>('Hotel information');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const loadKnowledgeBase = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getKnowledgeBase(token, selectedCategory);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBase();
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Title and Content are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.admin.updateKnowledgeItem(token, editingId, { category, title, content });
      } else {
        await api.admin.addKnowledgeItem(token, { category, title, content });
      }
      resetForm();
      loadKnowledgeBase();
    } catch (err: any) {
      alert(err.message || 'Failed to save knowledge item');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setCategory(item.category);
    setTitle(item.title);
    setContent(item.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge base entry?')) return;
    try {
      await api.admin.deleteKnowledgeItem(token, id);
      loadKnowledgeBase();
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCategory('Hotel information');
    setTitle('');
    setContent('');
  };

  const filteredItems = items.filter(
    item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#C5A059]/20 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-[#C5A059]">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-[#1A1A1A] font-medium">SBM Concierge Knowledge Base</h1>
            <p className="text-xs text-stone-500">
              Manage facts, rules, room details, and policies taught to the SBM AI Hotel Concierge.
            </p>
          </div>
        </div>

        <button
          onClick={loadKnowledgeBase}
          className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C5A059]' : ''}`} /> Sync Engine
        </button>
      </div>

      {/* Editor Form */}
      <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="font-serif text-lg font-medium text-stone-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#C5A059]" />
            {editingId ? 'Edit Knowledge Base Entry' : 'Add New Knowledge Entry'}
          </h3>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Knowledge Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as KnowledgeCategory)}
                className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#C5A059]"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Topic Title</label>
              <input
                type="text"
                placeholder="e.g. Salasar Balaji Temple Distance & Aarti Timings"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Factual Information / Policy Details</label>
            <textarea
              rows={3}
              placeholder="Provide exact facts for the AI Concierge. Do not include unverified details."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full text-xs p-3 border border-stone-300 rounded-lg focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-medium px-5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Save className="w-3.5 h-3.5 text-[#C5A059]" />
              {saving ? 'Saving...' : editingId ? 'Update Entry' : 'Save to AI Knowledge Base'}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and List Table */}
      <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search knowledge items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500">Filter Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Knowledge Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
              <tr>
                <th className="p-3">Category</th>
                <th className="p-3">Topic Title</th>
                <th className="p-3">Factual Knowledge</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-stone-400 italic">
                    No knowledge items found matching search.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="p-3 shrink-0 whitespace-nowrap">
                      <span className="bg-[#C5A059]/10 text-[#8B6B23] text-[10px] font-bold px-2 py-0.5 rounded border border-[#C5A059]/20">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-stone-900 font-serif">{item.title}</td>
                    <td className="p-3 text-stone-600 max-w-md truncate">{item.content}</td>
                    <td className="p-3 text-right shrink-0">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-stone-500 hover:text-[#C5A059] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-stone-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
