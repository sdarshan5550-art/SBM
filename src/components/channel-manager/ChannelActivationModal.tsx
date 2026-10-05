import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Key,
  Layers,
  DollarSign,
  RotateCw,
  Zap,
  X,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelConfig, ChannelRoomMapping, ChannelRateMapping, PropertyCode } from '../../types';

interface Props {
  channel: ChannelConfig;
  isOpen: boolean;
  onClose: () => void;
  onActivated: (updatedChannel: ChannelConfig) => void;
  roomMappings: ChannelRoomMapping[];
  rateMappings: ChannelRateMapping[];
}

export const ChannelActivationModal: React.FC<Props> = ({
  channel,
  isOpen,
  onClose,
  onActivated,
  roomMappings,
  rateMappings
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Settings / Credentials
  const [propertyId, setPropertyId] = useState<string>(channel.settings?.propertyId || '');
  const [accountRef, setAccountRef] = useState<string>(channel.settings?.accountReference || '');
  const [apiKey, setApiKey] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [priceMultiplier, setPriceMultiplier] = useState<number>(channel.settings?.priceMultiplier || 1.15);

  // Step 2: Connection Test Result
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Step 3: Validation Result
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setTestResult(null);
      setValidationResult(null);
      setPropertyId(channel.settings?.propertyId || '');
      setAccountRef(channel.settings?.accountReference || '');
      setPriceMultiplier(channel.settings?.priceMultiplier || 1.15);
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  const relevantRoomMappings = roomMappings.filter(m => (m.channel_id === channel.id || m.channel_code === channel.code) && m.is_active);
  const relevantRateMappings = rateMappings.filter(m => (m.channel_id === channel.id || m.channel_code === channel.code) && m.is_active);

  const handleSaveCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const updates: any = {
        settings: {
          ...channel.settings,
          propertyId: propertyId.trim() || undefined,
          accountReference: accountRef.trim() || undefined,
          priceMultiplier: Number(priceMultiplier) || 1.0,
          autoSyncInventory: true,
          autoImportReservations: true
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

      await api.channelManager.updateChannel(channel.id, updates);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to save channel credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRunConnectionTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.channelManager.testChannel(channel.id);
      setTestResult(res);
      if (res.success) {
        setStep(3);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunValidation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.channelManager.validateChannel(channel.id);
      setValidationResult(res);
      if (res.valid) {
        setStep(4);
      }
    } catch (err: any) {
      setError(err.message || 'Validation request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalActivation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.channelManager.activateChannel(channel.id);
      if (res.success) {
        onActivated(res.channel);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Channel Activation Workflow</h3>
              <p className="text-xs text-stone-300">
                Safely certify and connect <span className="font-semibold text-amber-400">{channel.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="bg-stone-50 border-b border-stone-200 px-6 py-3 flex items-center justify-between text-xs font-medium text-stone-500">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-amber-700 font-bold' : step > 1 ? 'text-emerald-700' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-amber-600 text-white' : step > 1 ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              1
            </span>
            <span>Credentials</span>
          </div>
          <ArrowRight className="w-3 h-3 text-stone-300" />

          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-amber-700 font-bold' : step > 2 ? 'text-emerald-700' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-amber-600 text-white' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              2
            </span>
            <span>Test Ping</span>
          </div>
          <ArrowRight className="w-3 h-3 text-stone-300" />

          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-amber-700 font-bold' : step > 3 ? 'text-emerald-700' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 3 ? 'bg-amber-600 text-white' : step > 3 ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              3
            </span>
            <span>Audit & Mapping</span>
          </div>
          <ArrowRight className="w-3 h-3 text-stone-300" />

          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-amber-700 font-bold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 4 ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              4
            </span>
            <span>Initial Sync</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Activation Blocked</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Enter the official Partner ID, API Key, and Webhook Secret provided by {channel.name}.
                  Credentials are encrypted and stored in write-only security format.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    OTA Property ID / Hotel Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={propertyId}
                    onChange={e => setPropertyId(e.target.value)}
                    placeholder="e.g. 1048291"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Account Reference / Username
                  </label>
                  <input
                    type="text"
                    value={accountRef}
                    onChange={e => setAccountRef(e.target.value)}
                    placeholder="e.g. sbmhotel_admin"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    API Key / Token (Write-Only)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={channel.credentialsConfigured ? '•••••••••••• (Configured - leave blank to keep)' : 'Enter API Key'}
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
                    placeholder={channel.settings?.webhookSecretMasked ? '•••••••••••• (Configured - leave blank to keep)' : 'Enter Webhook Secret'}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Rate Multiplier (Channel Markup)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="3.0"
                      value={priceMultiplier}
                      onChange={e => setPriceMultiplier(Number(e.target.value))}
                      className="w-32 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                    <span className="text-xs text-stone-500">
                      e.g. <strong>1.15</strong> pushes rates with a +15% commission markup to {channel.name}.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TEST CONNECTION */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center py-6 px-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <RotateCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                </div>
                <h4 className="text-sm font-bold text-stone-800">Verify Adapter Communication</h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Ping the channel adapter interface for {channel.name} to verify security certificates, credentials syntax, and gateway status.
                </p>

                {testResult && (
                  <div className={`p-4 rounded-xl text-left border ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                      <span>{testResult.success ? 'Adapter Verification Passed' : 'Adapter Status Note'}</span>
                    </div>
                    <p className="text-xs">{testResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: MAPPING AUDIT & VALIDATION */}
          {step === 3 && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Channel Mapping & Readiness Audit</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-3.5 rounded-xl border ${relevantRoomMappings.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-800">Room Mappings</span>
                    {relevantRoomMappings.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded font-semibold">{relevantRoomMappings.length} Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded font-semibold">0 Mapped</span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    {relevantRoomMappings.length > 0
                      ? 'Room mappings present for this channel.'
                      : 'Critical: You must map at least one SBM room type to an OTA room ID before activating.'}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${relevantRateMappings.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-800">Rate Plan Mappings</span>
                    {relevantRateMappings.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded font-semibold">{relevantRateMappings.length} Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded font-semibold">0 Mapped</span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    {relevantRateMappings.length > 0
                      ? 'Rate plan mappings present for this channel.'
                      : 'Critical: You must map at least one PMS rate plan to an OTA rate plan before activating.'}
                  </p>
                </div>
              </div>

              {validationResult && (
                <div className="space-y-2">
                  {validationResult.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                      <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-600" />
                        Critical Blocking Errors ({validationResult.errors.length})
                      </p>
                      <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Configuration Warnings ({validationResult.warnings.length})
                      </p>
                      <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                        {validationResult.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONFIRMATION & INITIAL SYNC */}
          {step === 4 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-800">Ready to Activate {channel.name}</h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                  Upon confirmation, SBM Channel Manager will mark {channel.name} as <strong>CONNECTED</strong>,
                  dispatch an initial 30-day inventory allocation, and push live rate mappings.
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between py-1 border-b border-stone-200">
                  <span className="text-stone-500">Channel Name:</span>
                  <span className="font-semibold text-stone-800">{channel.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200">
                  <span className="text-stone-500">Active Room Mappings:</span>
                  <span className="font-semibold text-emerald-700">{relevantRoomMappings.length} Rooms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200">
                  <span className="text-stone-500">Active Rate Plans:</span>
                  <span className="font-semibold text-emerald-700">{relevantRateMappings.length} Plans</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Initial Push Scope:</span>
                  <span className="font-semibold text-stone-800">Next 30 Days (Central PMS Truth)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
            >
              Cancel
            </button>
          )}

          {step === 1 && (
            <button
              onClick={handleSaveCredentials}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              Save & Test Connection
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleRunConnectionTest}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  Test & Audit Mapping
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleRunValidation}
              disabled={loading || (relevantRoomMappings.length === 0 || relevantRateMappings.length === 0)}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Auditing...
                </>
              ) : (
                <>
                  Validate & Proceed
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleFinalActivation}
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Activating Channel...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Confirm & ACTIVATE CHANNEL
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
