import React, { useState, useEffect } from 'react';

export type PolicyTabKey = 'terms' | 'governing' | 'privacy' | 'refund';

interface PoliciesPageProps {
  initialTab?: PolicyTabKey;
  onTabChange?: (tab: PolicyTabKey) => void;
}

export const PoliciesPage: React.FC<PoliciesPageProps> = ({
  initialTab = 'terms',
  onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTabKey>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabClick = (tab: PolicyTabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-[#1A1A1A]">
      <div className="text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Legal &amp; Policies</span>
        <h1 className="text-3xl font-serif text-[#1A1A1A] font-medium">
          Hotel Policies &amp; Legal Information
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 justify-center flex-wrap gap-2 sm:gap-6">
        <button
          onClick={() => handleTabClick('terms')}
          className={`pb-3 px-2 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'terms'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Terms &amp; Conditions
        </button>

        <button
          onClick={() => handleTabClick('governing')}
          className={`pb-3 px-2 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'governing'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Governing Law &amp; Jurisdiction
        </button>

        <button
          onClick={() => handleTabClick('privacy')}
          className={`pb-3 px-2 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'privacy'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Privacy Policy
        </button>

        <button
          onClick={() => handleTabClick('refund')}
          className={`pb-3 px-2 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors border-b-2 cursor-pointer ${
            activeTab === 'refund'
              ? 'border-[#C5A059] text-[#C5A059]'
              : 'border-transparent text-[#666666] hover:text-[#1A1A1A]'
          }`}
        >
          Refund &amp; Cancellation
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-6 text-xs text-[#666666] leading-relaxed shadow-sm">
        {activeTab === 'terms' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-serif font-bold text-[#C5A059] mb-3">Terms &amp; Conditions of Accommodation</h3>
              <div className="space-y-3">
                <p>1. <strong>Check-in &amp; Check-out:</strong> Check-in time is 12:00 PM and Check-out time is 11:00 AM. Early check-in or late check-out is subject to room availability and front desk confirmation.</p>
                <p>2. <strong>Identity Verification:</strong> In accordance with government directives, all adult guests must present valid government photo identification (Aadhaar Card, Voter ID, Passport, or Driving License) upon check-in.</p>
                <p>3. <strong>Sanctuary Guidelines:</strong> SBM Hotel and SBM 2 Guest House operate as pure vegetarian family properties adhering to the spiritual sanctity of Sri Salasar Balaji Dham. Non-vegetarian items, alcohol, and prohibited substances are strictly disallowed anywhere on the premises.</p>
                <p>4. <strong>Tariff &amp; Taxation:</strong> Published rates are subject to applicable GST and hospitality regulations as defined by the Government of India.</p>
                <p>5. <strong>Room Occupancy:</strong> Guests must adhere to maximum capacity limits specified for Deluxe Room (2 adults), Super Deluxe Room (2 adults), and Family Suite (4 adults).</p>
              </div>
            </div>

            {/* Dedicated Governing Law Section inside Terms & Conditions */}
            <div className="pt-5 border-t border-stone-200">
              <h4 className="text-sm font-serif font-bold text-[#1A1A1A] mb-3">Governing Law and Jurisdiction</h4>
              <div className="bg-stone-50 border border-stone-200 p-4 space-y-3 text-[#555555]">
                <p>These terms and conditions shall be governed by and interpreted in accordance with the laws of India.</p>
                <p>Any disputes, claims, or legal proceedings arising out of or relating to the use of this website, hotel reservations, accommodation services, or these terms and conditions shall be subject to the exclusive jurisdiction of the competent courts located in Jaipur, Rajasthan, India, to the extent legally permissible.</p>
                <p>Guests agree to comply with all applicable Indian laws, regulations, and hotel policies during their stay.</p>
                <p>Nothing in this clause shall exclude or limit any statutory rights or remedies available to consumers under applicable Indian law.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'governing' && (
          <div className="space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059] block mb-1">
                Legal Jurisdiction
              </span>
              <h3 className="text-lg font-serif font-bold text-[#1A1A1A]">Governing Law and Jurisdiction</h3>
              <div className="w-10 h-0.5 bg-[#C5A059] my-2" />
            </div>

            <div className="space-y-4 text-xs text-[#555555] leading-relaxed">
              <p className="text-stone-700 font-medium">
                These terms and conditions shall be governed by and interpreted in accordance with the laws of India.
              </p>

              <p>
                Any disputes, claims, or legal proceedings arising out of or relating to the use of this website, hotel reservations, accommodation services, or these terms and conditions shall be subject to the exclusive jurisdiction of the competent courts located in Jaipur, Rajasthan, India, to the extent legally permissible.
              </p>

              <p>
                Guests agree to comply with all applicable Indian laws, regulations, and hotel policies during their stay.
              </p>

              <p>
                Nothing in this clause shall exclude or limit any statutory rights or remedies available to consumers under applicable Indian law.
              </p>
            </div>

            <div className="bg-stone-50 border-l-2 border-[#C5A059] p-4 text-[11px] text-stone-600 mt-6">
              <p className="font-semibold text-[#1A1A1A] mb-1">Applicability:</p>
              <p>This governing law clause applies to all reservations, transactions, services, inquiries, and content across SBM Hotel (Main Temple Road, Salasar) and SBM 2 Guest House (Temple Approach Road, Salasar), Rajasthan, India.</p>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="text-base font-serif font-bold text-[#C5A059]">Privacy Policy</h3>
            <p>1. SBM Hotel respects your privacy. Guest data (Name, Phone, Email, Address) is collected solely for reservation confirmation, check-in processing, guest communications, and essential support.</p>
            <p>2. We do not sell, disclose, or distribute guest details to external marketing agencies.</p>
            <p>3. Digital transaction details are securely processed via industry-standard encrypted payment gateways. No sensitive payment card details or net banking credentials are stored on our servers.</p>
            <p>4. Guest identity documents presented at check-in are handled with strict confidentiality in compliance with regulatory and statutory requirements.</p>
          </div>
        )}

        {activeTab === 'refund' && (
          <div className="space-y-4">
            <h3 className="text-base font-serif font-bold text-[#C5A059]">Refund &amp; Cancellation Policy</h3>
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
