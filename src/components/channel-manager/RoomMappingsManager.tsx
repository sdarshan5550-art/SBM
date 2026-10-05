import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  X,
  Search,
  Globe,
  ArrowRight,
  Shield
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelRoomMapping, ChannelConfig, PropertyCode } from '../../types';

interface Props {
  roomMappings: ChannelRoomMapping[];
  channels: ChannelConfig[];
  propertyCode: PropertyCode | 'all';
  onMappingsChanged: () => void;
}

export const RoomMappingsManager: React.FC<Props> = ({
  roomMappings,
  channels,
  propertyCode,
  onMappingsChanged
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingMapping, setEditingMapping] = useState<Partial<ChannelRoomMapping> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Fields
  const [formChannelId, setFormChannelId] = useState<string>('');
  const [formPropertyCode, setFormPropertyCode] = useState<PropertyCode>('sbm-hotel');
  const [formPmsRoomTypeId, setFormPmsRoomTypeId] = useState<string>('room-sbm-deluxe');
  const [formPmsRoomTypeName, setFormPmsRoomTypeName] = useState<string>('Deluxe Room');
  const [formOtaRoomId, setFormOtaRoomId] = useState<string>('');
  const [formOtaRoomName, setFormOtaRoomName] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formSyncInventory, setFormSyncInventory] = useState<boolean>(true);

  const filteredMappings = roomMappings.filter(m => {
    if (selectedChannelId !== 'all' && m.channel_id !== selectedChannelId && m.channel_code !== selectedChannelId) {
      return false;
    }
    return true;
  });

  const handleOpenAdd = () => {
    const firstChan = channels.find(c => c.code !== 'DIRECT') || channels[0];
    setEditingMapping(null);
    setFormChannelId(firstChan?.id || '');
    setFormPropertyCode('sbm-hotel');
    setFormPmsRoomTypeId('room-sbm-deluxe');
    setFormPmsRoomTypeName('Deluxe Room');
    setFormOtaRoomId('');
    setFormOtaRoomName('');
    setFormIsActive(true);
    setFormSyncInventory(true);
    setShowModal(true);
    setNotification(null);
  };

  const handleOpenEdit = (mapping: ChannelRoomMapping) => {
    setEditingMapping(mapping);
    setFormChannelId(mapping.channel_id);
    setFormPropertyCode(mapping.property_code);
    setFormPmsRoomTypeId(mapping.pms_room_type_id);
    setFormPmsRoomTypeName(mapping.pms_room_type_name);
    setFormOtaRoomId(mapping.channel_room_id);
    setFormOtaRoomName(mapping.channel_room_name);
    setFormIsActive(mapping.is_active);
    setFormSyncInventory(mapping.sync_inventory);
    setShowModal(true);
    setNotification(null);
  };

  const handleSave = async () => {
    if (!formOtaRoomId.trim()) {
      setNotification({ type: 'error', message: 'OTA Room ID is required.' });
      return;
    }

    const chan = channels.find(c => c.id === formChannelId);
    const channelCode = chan ? chan.code : 'BOOKING_COM';

    setLoading(true);
    setNotification(null);

    try {
      await api.channelManager.saveRoomMapping({
        id: editingMapping?.id,
        channel_id: formChannelId,
        channel_code: channelCode,
        property_code: formPropertyCode,
        pms_room_type_id: formPmsRoomTypeId,
        pms_room_type_name: formPmsRoomTypeName,
        channel_room_id: formOtaRoomId.trim(),
        channel_room_name: formOtaRoomName.trim() || formPmsRoomTypeName,
        is_active: formIsActive,
        sync_inventory: formSyncInventory
      });

      setNotification({
        type: 'success',
        message: `Successfully mapped ${formPmsRoomTypeName} ➔ ${formOtaRoomId} (${channelCode})`
      });
      setShowModal(false);
      onMappingsChanged();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save room mapping.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this OTA room mapping?')) return;
    setLoading(true);
    try {
      await api.channelManager.deleteRoomMapping(id);
      setNotification({ type: 'success', message: 'Room mapping deleted.' });
      onMappingsChanged();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Delete failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedChannelId}
            onChange={e => setSelectedChannelId(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
          >
            <option value="all">All Channels ({roomMappings.length} total mappings)</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({roomMappings.filter(m => m.channel_id === c.id || m.channel_code === c.code).length} mapped)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Map New Room
        </button>
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Room Mappings Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">SBM PMS Room</th>
                <th className="p-3.5">OTA Room ID</th>
                <th className="p-3.5">OTA Room Name</th>
                <th className="p-3.5">Mapping Status</th>
                <th className="p-3.5">Sync Inventory</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    No room mappings configured for this channel. Click "Map New Room" to connect PMS room categories to OTA extranet room codes.
                  </td>
                </tr>
              ) : (
                filteredMappings.map(m => (
                  <tr key={m.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-stone-900">
                      {m.channel_code}
                    </td>
                    <td className="p-3.5 font-semibold text-stone-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {m.pms_room_type_name}
                      <span className="text-[10px] text-stone-400 capitalize block">({m.property_code.replace('-', ' ')})</span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-stone-800">
                      {m.channel_room_id}
                    </td>
                    <td className="p-3.5 text-stone-700">
                      {m.channel_room_name}
                    </td>
                    <td className="p-3.5">
                      {m.is_active ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                          MAPPED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-600 font-semibold rounded text-[10px]">
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {m.sync_inventory ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                        </span>
                      ) : (
                        <span className="text-stone-400">Paused</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="p-1.5 text-stone-600 hover:text-amber-700 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Edit Mapping"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Delete Mapping"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">
                  {editingMapping ? 'Edit OTA Room Mapping' : 'Map SBM Room to OTA Room'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-stone-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Target Channel</label>
                <select
                  value={formChannelId}
                  onChange={e => setFormChannelId(e.target.value)}
                  disabled={Boolean(editingMapping)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-stone-100"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Property</label>
                  <select
                    value={formPropertyCode}
                    onChange={e => setFormPropertyCode(e.target.value as PropertyCode)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="sbm-hotel">SBM Hotel</option>
                    <option value="sbm-guest-house">SBM 2 Guest House</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">PMS Room Category</label>
                  <select
                    value={formPmsRoomTypeId}
                    onChange={e => {
                      setFormPmsRoomTypeId(e.target.value);
                      if (e.target.value.includes('family')) {
                        setFormPmsRoomTypeName('Family Suite');
                      } else {
                        setFormPmsRoomTypeName('Deluxe Room');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="room-sbm-deluxe">Deluxe Room (SBM Hotel)</option>
                    <option value="room-sbm-family">Family Suite (SBM Hotel)</option>
                    <option value="room-gh-deluxe">Deluxe Room (Guest House)</option>
                    <option value="room-gh-family">Family Suite (Guest House)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    OTA Room ID / Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formOtaRoomId}
                    onChange={e => setFormOtaRoomId(e.target.value)}
                    placeholder="e.g. BKG-DLX-01"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">Must be unique per channel.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    OTA Extranet Room Label
                  </label>
                  <input
                    type="text"
                    value={formOtaRoomName}
                    onChange={e => setFormOtaRoomName(e.target.value)}
                    placeholder="e.g. Deluxe Double Room"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Active Mapping
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSyncInventory}
                    onChange={e => setFormSyncInventory(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Sync Real-Time Availability
                </label>
              </div>
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !formOtaRoomId.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Room Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
