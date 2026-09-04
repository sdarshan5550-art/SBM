import React, { useState } from 'react';

export const PoliciesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'refund'>('terms');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-[#1A1A1A]">
      <div className="text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Legal & Policies</span>
        <h1 className="text-3xl font-serif text-[#1A1A1A] font-medium">
          Hotel Policies
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 justify-center gap-4 sm:gap-8">
        <button
          onClick={() => setActiveTab('terms')}
          className={`pb-3 text-[11px] font-bold tracking-[0.2em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'terms'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Terms & Conditions
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`pb-3 text-[11px] font-bold tracking-[0.2em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'privacy'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Privacy Policy
        </button>

        <button
          onClick={() => setActiveTab('refund')}
          className={`pb-3 text-[11px] font-bold tracking-[0.2em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'refund'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Refund & Cancellation
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-4 text-xs text-[#666666] leading-relaxed shadow-sm">
        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-base font-serif font-bold text-[#C5A059]">Terms & Conditions of Accommodation</h3>
            <p>1. Check-in time is 12:00 PM and Check-out time is 11:00 AM. Early check-in or late check-out is subject to room availability and front desk confirmation.</p>
            <p>2. In accordance with government directives, all adult guests must present valid photo identification (Aadhaar Card, Voter ID, or Passport) at check-in.</p>
            <p>3. SBM Hotel operates as a pure vegetarian sanctuary adhering to local spiritual tradition near Sri Salasar Balaji Temple. Non-vegetarian items or alcohol are strictly prohibited on the premises.</p>
            <p>4. Rates are subject to applicable GST and local hospitality taxes.</p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="text-base font-serif font-bold text-[#C5A059]">Privacy Policy</h3>
            <p>1. SBM Hotel respects your privacy. Guest data (Name, Phone, Email) is collected solely for reservation confirmation, check-in processing, and essential guest support.</p>
            <p>2. We do not sell, disclose, or distribute guest details to external marketing agencies.</p>
            <p>3. Digital transaction details are securely processed via industry-standard encrypted payment gateways.</p>
          </div>
        )}

        {activeTab === 'refund' && (
          <div className="space-y-4">
            <h3 className="text-base font-serif font-bold text-[#C5A059]">Refund & Cancellation Policy</h3>
            <p>1. Cancellations made 48 hours or more before check-in time: Eligible for 100% full refund.</p>
            <p>2. Cancellations made between 24 and 48 hours before check-in: Eligible for 50% refund.</p>
            <p>3. Cancellations made within 24 hours of check-in date or No-Show: Non-refundable.</p>
            <p>4. Approved refunds will be processed back to the original payment source within 5-7 business days.</p>
          </div>
        )}
      </div>
    </div>
  );
};
