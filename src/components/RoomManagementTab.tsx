import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  Image as ImageIcon,
  Wifi,
  Wind,
  Car,
  Tv,
  Droplets,
  Utensils,
  BedDouble,
  CheckCircle2,
  Wrench
} from 'lucide-react';
import { api } from '../lib/api';
import { PhysicalRoom, Property, RoomType, RoomStatus } from '../types';

const FACILITIES = [
  { name: 'Wi-Fi', icon: Wifi },
  { name: 'Air Conditioning', icon: Wind },
  { name: 'Parking', icon: Car },
  { name: 'TV', icon: Tv },
  { name: 'Hot Water', icon: Droplets },
  { name: 'Room Service', icon: Utensils },
  { name: 'King Bed', icon: BedDouble },
];

const STATUSES: RoomStatus[] = [
  'Available',
  'Reserved',
  'Occupied',
  'Maintenance',
  'Blocked'
];

interface ExtendedRoom extends PhysicalRoom {
  facilities?: string[];
  images?: string[];
  description?: string;
  max_guests?: number;
  bed_type?: string;
  room_size?: string;
}

export const RoomManagementTab: React.FC = () => {
  const [rooms, setRooms] = useState<ExtendedRoom[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExtendedRoom | null>(null);

  const emptyRoom: ExtendedRoom = {
    id: '',
    property_code: 'sbm-hotel',
    property_name: 'SBM Hotel',
    room_type_id: '',
    room_code: 'deluxe',
    room_name: 'Deluxe Room',
    room_number: '',
    floor: 'Floor 1',
    status: 'Available',
    updated_at: new Date().toISOString(),
    facilities: [],
    description: '',
    max_guests: 2,
    bed_type: 'King Bed',
    room_size: ''
  };

  const [form, setForm] = useState<ExtendedRoom>(emptyRoom);

  const loadRooms = async () => {
    try {
      setLoading(true);

      const [roomData, propertyData, typeData] = await Promise.all([
        api.getPhysicalRooms(),
        api.getProperties(),
        api.getRoomTypes()
      ]);

      setRooms(roomData as ExtendedRoom[]);
      setProperties(propertyData);
      setRoomTypes(typeData);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Unable to load rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch =
        room.room_number.toLowerCase().includes(search.toLowerCase()) ||
        room.room_name.toLowerCase().includes(search.toLowerCase()) ||
        (room.current_guest_name || '').toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || room.status === statusFilter;

      const matchesProperty =
        propertyFilter === 'all' || room.property_code === propertyFilter;

      return matchesSearch && matchesStatus && matchesProperty;
    });
  }, [rooms, search, statusFilter, propertyFilter]);

  const counts = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'Available').length,
    reserved: rooms.filter(r => r.status === 'Reserved').length,
    occupied: rooms.filter(r => r.status === 'Occupied').length,
    maintenance: rooms.filter(r => r.status === 'Maintenance').length,
    blocked: rooms.filter(r => r.status === 'Blocked').length
  };

  const openCreate = () => {
    setEditingRoom(null);

    const firstProperty = properties[0];
    const firstRoomType = roomTypes.find(
      r => r.property_code === firstProperty?.code
    );

    setForm({
      ...emptyRoom,
      property_code: firstProperty?.code || 'sbm-hotel',
      property_name: firstProperty?.name || 'SBM Hotel',
      room_type_id: firstRoomType?.id || '',
      room_code: firstRoomType?.room_code || 'deluxe',
      room_name: firstRoomType?.name || 'Deluxe Room',
      facilities: ['Wi-Fi', 'Air Conditioning'],
    });

    setShowModal(true);
  };

  const openEdit = (room: ExtendedRoom) => {
    setEditingRoom(room);

    setForm({
      ...room,
      facilities: room.facilities || [],
    });

    setShowModal(true);
  };

  const handlePropertyChange = (propertyCode: string) => {
    const property = properties.find(p => p.code === propertyCode);

    const type = roomTypes.find(
      r => r.property_code === propertyCode
    );

    setForm(prev => ({
      ...prev,
      property_code: propertyCode as any,
      property_name: property?.name || '',
      room_type_id: type?.id || '',
      room_code: type?.room_code || 'deluxe',
      room_name: type?.name || 'Deluxe Room'
    }));
  };

  const handleRoomTypeChange = (roomTypeId: string) => {
    const type = roomTypes.find(r => r.id === roomTypeId);

    if (!type) return;

    setForm(prev => ({
      ...prev,
      room_type_id: type.id,
      room_code: type.room_code,
      room_name: type.name
    }));
  };
  const toggleFacility = (facility: string) => {
    setForm(prev => ({
      ...prev,
      facilities: prev.facilities?.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...(prev.facilities || []), facility]
    }));
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.room_number.trim()) {
      alert('Please enter a room number.');
      return;
    }

    if (!form.property_code) {
      alert('Please select a property.');
      return;
    }

    if (!form.room_type_id) {
      alert('Please select a room category.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        property_code: form.property_code,
        property_name: form.property_name,
        room_type_id: form.room_type_id,
        room_code: form.room_code,
        room_name: form.room_name,
        room_number: form.room_number.trim(),
        floor: form.floor,
        status: form.status,
        facilities: form.facilities || [],
        description: form.description || '',
        max_guests: Number(form.max_guests || 2),
        bed_type: form.bed_type || '',
        room_size: form.room_size || ''
      };

      if (editingRoom) {
        await api.updatePhysicalRoom(
          '',
          editingRoom.id,
          payload
        );
        alert('Room updated successfully.');
      } else {
        await api.addPhysicalRoom('', payload);
        alert('Room created successfully.');
      }

      setShowModal(false);
      await loadRooms();
    } catch (error: any) {
      alert(error.message || 'Unable to save room.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    room: ExtendedRoom,
    status: RoomStatus
  ) => {
    try {
      await api.updatePhysicalRoom('', room.id, { status });

      setRooms(prev =>
        prev.map(r =>
          r.id === room.id
            ? { ...r, status }
            : r
        )
      );
    } catch (error: any) {
      alert(error.message || 'Unable to update status.');
    }
  };

  const deleteRoom = async (room: ExtendedRoom) => {
    if (!confirm(
      `Permanently delete Room ${room.room_number} (${room.property_name || room.property_code})? This will remove it from the system.`
    )) {
      return;
    }

    try {
      await api.deletePhysicalRoom('', room.id);
      await loadRooms();
      alert(`Room ${room.room_number} has been permanently deleted.`);
    } catch (error: any) {
      alert(error.message || 'Unable to delete room.');
    }
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Reserved':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Occupied':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Maintenance':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Blocked':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-[#1A1A1A]">
            Room Management
          </h2>

          <p className="text-xs text-[#666666] mt-1">
            Manage individual physical rooms, room status, facilities and images.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-[#1A1A1A] text-white px-5 py-3 text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[#333333]"
        >
          <Plus className="w-4 h-4 text-[#C5A059]" />
          Add Physical Room
        </button>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

        {[
          ['Total', counts.total, 'text-[#1A1A1A]'],
          ['Available', counts.available, 'text-emerald-700'],
          ['Reserved', counts.reserved, 'text-amber-700'],
          ['Occupied', counts.occupied, 'text-blue-700'],
          ['Maintenance', counts.maintenance, 'text-red-700'],
          ['Blocked', counts.blocked, 'text-stone-700']
        ].map(([label, value, color]) => (
          <div
            key={label as string}
            className="bg-white border border-stone-200 p-4"
          >
            <div className="text-[9px] uppercase tracking-widest text-[#777]">
              {label}
            </div>

            <div className={`text-2xl font-bold mt-1 ${color}`}>
              {value}
            </div>
          </div>
        ))}

      </div>

      {/* FILTERS */}
      <div className="bg-white border border-stone-200 p-4 flex flex-col md:flex-row gap-3">

        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search room number or guest..."
            className="w-full border border-stone-200 pl-9 pr-3 py-2.5 text-xs outline-none focus:border-[#C5A059]"
          />
        </div>

        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="border border-stone-200 px-3 py-2.5 text-xs"
        >
          <option value="all">All Properties</option>

          {properties.map(property => (
            <option
              key={property.code}
              value={property.code}
            >
              {property.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-stone-200 px-3 py-2.5 text-xs"
        >
          <option value="all">All Statuses</option>

          {STATUSES.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

      </div>

      {/* ROOM TABLE */}
      <div className="bg-white border border-stone-200 overflow-hidden">

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No rooms found.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs">

              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="p-4">Room</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Property</th>
                  <th className="p-4">Floor</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Guest / Booking</th>
                  <th className="p-4">Facilities</th>
                  <th className="p-4">Photos</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredRooms.map(room => (

                  <tr
                    key={room.id}
                    className="border-b border-stone-100 hover:bg-stone-50"
                  >

                    <td className="p-4">
                      <div className="font-bold text-base">
                        {room.room_number}
                      </div>
                    </td>

                    <td className="p-4">
                      {room.room_name}
                    </td>

                    <td className="p-4">
                      {room.property_name}
                    </td>

                    <td className="p-4">
                      {room.floor || '-'}
                    </td>

                    <td className="p-4">

                      <select
                        value={room.status}
                        onChange={e =>
                          changeStatus(
                            room,
                            e.target.value as RoomStatus
                          )
                        }
                        className={`px-2 py-1.5 border text-[10px] font-bold uppercase ${statusClass(room.status)}`}
                      >

                        {STATUSES.map(status => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        ))}

                      </select>

                    </td>

                    <td className="p-4">

                      {room.current_guest_name ? (
                        <div>
                          <div className="font-semibold">
                            {room.current_guest_name}
                          </div>

                          {room.assigned_booking_id && (
                            <div className="text-[10px] text-gray-500">
                              {room.assigned_booking_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}

                    </td>

                    <td className="p-4">

                      <div className="flex flex-wrap gap-1 max-w-[180px]">

                        {(room.facilities || []).slice(0, 4).map(f => (
                          <span
                            key={f}
                            className="bg-stone-100 px-2 py-1 text-[9px]"
                          >
                            {f}
                          </span>
                        ))}

                        {(room.facilities || []).length > 4 && (
                          <span className="text-[9px] text-gray-500">
                            +{room.facilities!.length - 4}
                          </span>
                        )}

                      </div>

                    </td>

                    <td className="p-4">

                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4 text-[#C5A059]" />
                        {(room.images || []).length}
                      </div>

                    </td>

                    <td className="p-4">

                      <div className="flex gap-2">

                        <button
                          onClick={() => openEdit(room)}
                          className="p-2 border border-stone-200 hover:bg-stone-100"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => deleteRoom(room)}
                          className="p-2 border border-red-200 text-red-600 hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (

        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            <div className="sticky top-0 bg-white border-b border-stone-200 p-5 flex items-center justify-between">

              <div>
                <h3 className="font-serif text-xl font-semibold">
                  {editingRoom ? 'Edit Physical Room' : 'Add Physical Room'}
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  Manage the physical room assigned to this property.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={saveRoom}
              className="p-6 space-y-6"
            >

              {/* BASIC DETAILS */}
              <div className="grid md:grid-cols-2 gap-4">

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Room Number *
                  </label>

                  <input
                    required
                    value={form.room_number}
                    onChange={e =>
                      setForm({
                        ...form,
                        room_number: e.target.value
                      })
                    }
                    placeholder="101"
                    className="w-full border border-stone-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Property *
                  </label>

                  <select
                    value={form.property_code}
                    onChange={e =>
                      handlePropertyChange(e.target.value)
                    }
                    className="w-full border border-stone-200 p-3 text-sm"
                  >

                    {properties.map(property => (
                      <option
                        key={property.code}
                        value={property.code}
                      >
                        {property.name}
                      </option>
                    ))}

                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Room Category *
                  </label>

                  <select
                    value={form.room_type_id}
                    onChange={e =>
                      handleRoomTypeChange(e.target.value)
                    }
                    className="w-full border border-stone-200 p-3 text-sm"
                  >

                    {roomTypes
                      .filter(r =>
                        r.property_code === form.property_code
                      )
                      .map(type => (
                        <option
                          key={type.id}
                          value={type.id}
                        >
                          {type.name}
                        </option>
                      ))}

                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Floor
                  </label>

                  <input
                    value={form.floor || ''}
                    onChange={e =>
                      setForm({
                        ...form,
                        floor: e.target.value
                      })
                    }
                    placeholder="Floor 1"
                    className="w-full border border-stone-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Maximum Guests
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={form.max_guests || 2}
                    onChange={e =>
                      setForm({
                        ...form,
                        max_guests: Number(e.target.value)
                      })
                    }
                    className="w-full border border-stone-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Bed Type
                  </label>

                  <input
                    value={form.bed_type || ''}
                    onChange={e =>
                      setForm({
                        ...form,
                        bed_type: e.target.value
                      })
                    }
                    placeholder="King Bed"
                    className="w-full border border-stone-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Room Size
                  </label>

                  <input
                    value={form.room_size || ''}
                    onChange={e =>
                      setForm({
                        ...form,
                        room_size: e.target.value
                      })
                    }
                    placeholder="250 sq.ft."
                    className="w-full border border-stone-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={e =>
                      setForm({
                        ...form,
                        status: e.target.value as RoomStatus
                      })
                    }
                    className="w-full border border-stone-200 p-3 text-sm"
                  >

                    {STATUSES.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}

                  </select>
                </div>

              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Room Description
                </label>

                <textarea
                  value={form.description || ''}
                  onChange={e =>
                    setForm({
                      ...form,
                      description: e.target.value
                    })
                  }
                  rows={4}
                  className="w-full border border-stone-200 p-3 text-sm"
                  placeholder="Describe this room..."
                />
              </div>

              {/* FACILITIES */}
              <div>

                <h4 className="font-serif font-semibold mb-3">
                  Room Facilities
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                  {FACILITIES.map(({ name, icon: Icon }) => {

                    const selected =
                      form.facilities?.includes(name);

                    return (
                      <button
                        type="button"
                        key={name}
                        onClick={() => toggleFacility(name)}
                        className={`border p-3 flex items-center gap-2 text-xs text-left ${
                          selected
                            ? 'border-[#C5A059] bg-[#C5A059]/10'
                            : 'border-stone-200'
                        }`}
                      >

                        <Icon className="w-4 h-4" />

                        <span>{name}</span>

                        {selected && (
                          <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-600" />
                        )}

                      </button>
                    );

                  })}

                </div>

              </div>


              {/* FOOTER */}
              <div className="border-t border-stone-200 pt-5 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-stone-200 px-5 py-3 text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#1A1A1A] text-white px-6 py-3 text-xs flex items-center gap-2 disabled:opacity-50"
                >

                  <Save className="w-4 h-4 text-[#C5A059]" />

                  {saving ? 'Saving...' : 'Save Room'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};