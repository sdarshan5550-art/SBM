import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Key,
  DollarSign,
  Check,
  X,
  RotateCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelConfig } from '../../types';

interface Props {
  channel: ChannelConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: ChannelConfig) => void;
}

export const ChannelConfigModal: React.FC<Props> = ({
  channel,
  isOpen,
  onClose,
  onSaved
}) => {
  const [propertyId, setPropertyId] = useState<string>('');
  const [accountRef, setAccountRef] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [priceMultiplier, setPriceMultiplier] = useState<number>(1.0);
  const [autoSyncInventory, setAutoSyncInventory] = useState<boolean>(true);
  const [autoImportReservations, setAutoImportReservations] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channel) {
      setPropertyId(channel.settings?.propertyId || '');
      setAccountRef(channel.settings?.accountReference || '');
      setApiKey('');
      setWebhookSecret('');
      setPriceMultiplier(channel.settings?.priceMultiplier || 1.0);
      setAutoSyncInventory(channel.settings?.autoSyncInventory !== false);
      setAutoImportReservations(channel.settings?.autoImportReservations !== false);
      setError(null);
    }
  }, [channel]);

  if (!isOpen || !channel) return null;

  const isDirect = channel.code === 'DIRECT';

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const updates: any = {
        settings: {
          ...channel.settings,
          propertyId: propertyId.trim() || undefined,
          accountReference: accountRef.trim() || undefined,
          priceMultiplier: Number(priceMultiplier) || 1.0,
          autoSyncInventory,
          autoImportReservations
        }
      };

      if (apiKey.trim()) {
        updates.apiKey = apiKey.trim();
        updates.settings.apiKeyMasked = `••••••••${apiKey.slice(-4)}`;
      }
      if (webhookSecret.trim()) {
        updates.webhookSecret = webhookSecret.trim();
        updates.settings.webhookSecretMasked = `••••••••${webhookSecret.slice(-4)}`;
      }

      const updated = await api.channelManager.updateChannel(channel.id, updates);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update channel settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold">{channel.name} Configuration</h3>
              <p className="text-xs text-stone-400">Manage API keys, rate multipliers, and sync rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!isDirect ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    OTA Property / Hotel ID
                  </label>
                  <input
                    type="text"
                    value={propertyId}
                    onChange={e => setPropertyId(e.target.value)}
                    placeholder="e.g. 1048291"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Account Reference
                  </label>
                  <input
                    type="text"
                    value={accountRef}
                    onChange={e => setAccountRef(e.target.value)}
                    placeholder="e.g. sbmhotel_admin"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  API Key / Token (Write-Only)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={channel.credentialsConfigured ? '•••••••••••• (Saved - enter new to change)' : 'Enter API Key'}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Inbound Webhook Secret (Write-Only)
                </label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  placeholder={channel.settings?.webhookSecretMasked ? '•••••••••••• (Saved - enter new to change)' : 'Enter Webhook Secret'}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-800">
              Direct Website connects natively with SBM central database. No third-party API credentials needed.
            </div>
          )}

          {/* Rate Multiplier */}
          <div className="pt-2 border-t border-stone-200">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Channel Rate Multiplier (Global for this channel)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="3.0"
                value={priceMultiplier}
                onChange={e => setPriceMultiplier(Number(e.target.value))}
                className="w-28 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
              />
              <span className="text-xs text-stone-500">
                e.g. <strong>1.15</strong> applies +15% OTA commission markup.
              </span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-stone-200">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncInventory}
                onChange={e => setAutoSyncInventory(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Auto-Synchronize Inventory on PMS Bookings
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={autoImportReservations}
                onChange={e => setAutoImportReservations(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Auto-Import Inbound Webhook Reservations
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
