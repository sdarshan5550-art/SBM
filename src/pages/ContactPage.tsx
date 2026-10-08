import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Send, CheckCircle2, Clock, Instagram, Facebook } from 'lucide-react';
import { api } from '../lib/api';
import { SocialMediaSettings } from '../types';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [socialSettings, setSocialSettings] = useState<SocialMediaSettings | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.social_media) {
        setSocialSettings(s.social_media);
      }
    }).catch(() => {});
  }, []);

  const instagramVisible = Boolean(
    socialSettings?.instagram?.enabled &&
    (socialSettings?.instagram?.show_on_contact ?? socialSettings?.instagram?.showOnContact ?? true) &&
    socialSettings?.instagram?.url
  );

  const facebookVisible = Boolean(
    socialSettings?.facebook?.enabled &&
    (socialSettings?.facebook?.show_on_contact ?? socialSettings?.facebook?.showOnContact ?? true) &&
    socialSettings?.facebook?.url
  );

  const hasContactSocials = instagramVisible || facebookVisible;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !message) {
      setError('Please fill in your Name, Phone Number, and Inquiry Message.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createInquiry({ name, phone, email, subject, message });
      setSubmitted(true);
      setName('');
      setPhone('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Get in Touch</span>
        <h1 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
          Contact SBM Hotel & Guest House
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
        <p className="text-xs sm:text-sm text-[#666666]">
          Have questions about room availability, group bookings, or darshan timings? Reach out to our front desk teams directly.
        </p>
      </div>

      {/* Two Properties Contact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* SBM Hotel Contact Box */}
        <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="border-b border-stone-100 pb-4">
            <span className="bg-[#C5A059]/10 text-[#C5A059] text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 border border-[#C5A059]/30">
              PROPERTY 1
            </span>
            <h3 className="text-2xl font-serif text-[#1A1A1A] font-medium mt-2">SBM Hotel</h3>
            <p className="text-xs text-[#666666] mt-0.5">Adjacent to Salasar Balaji Temple</p>
          </div>

          <div className="space-y-3 text-xs text-[#666666]">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Address:</strong>
                <span>Main Temple Road, Opposite Salasar Balaji Temple, Salasar, Rajasthan 331506</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Phone Numbers:</strong>
                <p>Mobile: <a href="tel:+919983567921" className="text-[#C5A059] hover:underline font-medium">+91 99 83 56 79 21</a></p>
                <p>Landline: <a href="tel:01568252186" className="text-[#1A1A1A]">01568 25 21 86</a></p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Email Address:</strong>
                <a href="mailto:sbmhotel@gmail.com" className="text-[#C5A059] hover:underline font-medium">sbmhotel@gmail.com</a>
              </div>
            </div>
          </div>
        </div>

        {/* SBM 2 Guest House Contact Box */}
        <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="border-b border-stone-100 pb-4">
            <span className="bg-[#C5A059]/10 text-[#C5A059] text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 border border-[#C5A059]/30">
              PROPERTY 2
            </span>
            <h3 className="text-2xl font-serif text-[#1A1A1A] font-medium mt-2">SBM 2 Guest House</h3>
            <p className="text-xs text-[#666666] mt-0.5">Near Temple Approach Road</p>
          </div>

          <div className="space-y-3 text-xs text-[#666666]">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Address:</strong>
                <span>Near Temple Approach Road, Salasar, Rajasthan 331506</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Phone Numbers:</strong>
                <p>Mobile: <a href="tel:+919828500845" className="text-[#C5A059] hover:underline font-medium">+91 98285 00845</a>, <a href="tel:+919828636000" className="text-[#C5A059] hover:underline font-medium">+91 98286 36000</a></p>
                <p>Landline: <a href="tel:01568294286" className="text-[#1A1A1A]">01568 294 286</a></p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1A1A1A]">Email Address:</strong>
                <a href="mailto:sbmguesthouse@gmail.com" className="text-[#C5A059] hover:underline font-medium">sbmguesthouse@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Media Links Section */}
      {hasContactSocials && (
        <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 text-center space-y-4 max-w-3xl mx-auto shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">Social Media</span>
          <h3 className="text-xl sm:text-2xl font-serif text-[#1A1A1A] font-medium">Connect With Us Online</h3>
          <p className="text-xs text-[#666666] max-w-md mx-auto">
            Stay updated with temple festivals, special room rates, and spiritual updates from Salasar Balaji.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {instagramVisible && (
              <a
                href={socialSettings!.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-[#FDFCFB] hover:bg-[#C5A059]/10 border border-stone-200 hover:border-[#C5A059] text-[#1A1A1A] hover:text-[#C5A059] transition-all text-xs font-medium rounded-xs shadow-2xs group"
              >
                <div className="w-7 h-7 rounded-full bg-[#1A1A1A] group-hover:bg-[#C5A059] text-white flex items-center justify-center transition-colors">
                  <Instagram className="w-3.5 h-3.5" />
                </div>
                <span>Follow us on Instagram</span>
              </a>
            )}
            {facebookVisible && (
              <a
                href={socialSettings!.facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-[#FDFCFB] hover:bg-[#C5A059]/10 border border-stone-200 hover:border-[#C5A059] text-[#1A1A1A] hover:text-[#C5A059] transition-all text-xs font-medium rounded-xs shadow-2xs group"
              >
                <div className="w-7 h-7 rounded-full bg-[#1A1A1A] group-hover:bg-[#C5A059] text-white flex items-center justify-center transition-colors">
                  <Facebook className="w-3.5 h-3.5" />
                </div>
                <span>Connect on Facebook</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Inquiry Form */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-10 shadow-sm max-w-3xl mx-auto">
        <div className="text-center space-y-2 mb-6">
          <h3 className="text-2xl font-serif text-[#1A1A1A] font-medium">Send Us an Inquiry</h3>
          <p className="text-xs text-[#666666]">Fill in the form below and our front desk manager will respond shortly.</p>
        </div>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3 text-emerald-900">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="text-base font-serif font-bold">Thank You! Your Inquiry Has Been Submitted.</h4>
            <p className="text-xs text-emerald-800">
              Our reservation team in Salasar will contact you shortly via phone or email.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-2 text-xs bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 font-medium cursor-pointer"
            >
              Send Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#1A1A1A] font-medium mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Anil Sharma"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-medium mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#1A1A1A] font-medium mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-medium mb-1">Subject (Optional)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Group booking enquiry"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#1A1A1A] font-medium mb-1">Message / Requirements *</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your stay dates, required room categories (Deluxe Room / Family Suite), or any questions..."
                className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-[11px] uppercase tracking-[0.2em]"
            >
              <Send className="w-4 h-4 text-[#C5A059]" />
              <span>{loading ? 'Submitting...' : 'Send Inquiry Message'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
