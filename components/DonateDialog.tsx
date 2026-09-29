import React, { useState } from 'react';
import { X, Heart, Copy, Check, CreditCard, Bitcoin } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';

/**
 * Donation targets. Intentionally empty: add your own addresses/URL here.
 * Any entry left empty is hidden; if all are empty the dialog renders nothing.
 * (The dialog is not currently mounted anywhere.)
 */
export const DONATE_CONFIG: { paypalUrl: string; btcAddress: string; ethAddress: string } = {
  paypalUrl: '',
  btcAddress: '',
  ethAddress: '',
};

interface DonateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

export const DonateDialog: React.FC<DonateDialogProps> = ({ isOpen, onClose, darkMode, uiLanguage }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const PAYPAL_URL = DONATE_CONFIG.paypalUrl;
  const BTC_ADDRESS = DONATE_CONFIG.btcAddress;
  const ETH_ADDRESS = DONATE_CONFIG.ethAddress;
  const hasCrypto = Boolean(BTC_ADDRESS || ETH_ADDRESS);

  if (!isOpen || (!PAYPAL_URL && !hasCrypto)) return null;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemBg = darkMode ? 'bg-[#333]' : 'bg-gray-50';
  
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      },
      () => {
        /* clipboard blocked: the address stays selectable */
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-[450px] max-w-full rounded-xl shadow-2xl border p-6 relative flex flex-col items-center ${bg}`}>
        <button onClick={onClose} aria-label={t(uiLanguage, 'close')} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
          <X size={24} />
        </button>
        
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
           <Heart size={32} fill="currentColor" />
        </div>

        <h2 className="text-2xl font-bold mb-2 text-center">{t(uiLanguage, 'donateTitle')}</h2>
        <p className={`text-center mb-8 text-sm px-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {t(uiLanguage, 'donateDesc')}
        </p>

        <div className="w-full space-y-4">
           {/* PayPal */}
           {PAYPAL_URL && (
           <a 
             href={PAYPAL_URL} 
             target="_blank" 
             rel="noopener noreferrer"
             className="flex items-center justify-center gap-3 w-full py-3 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-lg font-bold transition-colors"
           >
              <CreditCard size={20} />
              {t(uiLanguage, 'viaPaypal')}
           </a>
           )}

           {hasCrypto && (
           <div className="relative flex items-center gap-4 py-4 before:content-[''] before:flex-1 before:h-px before:bg-current before:opacity-10 after:content-[''] after:flex-1 after:h-px after:bg-current after:opacity-10">
              <span className="text-xs uppercase opacity-50 tracking-widest">{t(uiLanguage, 'viaCrypto')}</span>
           </div>
           )}

           {/* Bitcoin */}
           {BTC_ADDRESS && (
           <div className={`p-4 rounded-lg border ${itemBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2 font-bold text-sm">
                    <Bitcoin size={18} className="text-orange-500" />
                    {t(uiLanguage, 'btcAddress')}
                 </div>
                 {copied === 'btc' && <span className="text-green-500 text-xs font-bold flex items-center gap-1"><Check size={12}/> {t(uiLanguage, 'copied')}</span>}
              </div>
              <div className="flex gap-2">
                 <code className={`flex-1 p-2 rounded text-xs break-all ${darkMode ? 'bg-black/20' : 'bg-gray-200'}`}>
                    {BTC_ADDRESS}
                 </code>
                 <button onClick={() => handleCopy(BTC_ADDRESS, 'btc')} className="p-2 hover:bg-gray-500/10 rounded">
                    <Copy size={16} />
                 </button>
              </div>
           </div>
           )}

           {/* Ethereum */}
           {ETH_ADDRESS && (
           <div className={`p-4 rounded-lg border ${itemBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2 font-bold text-sm">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    {t(uiLanguage, 'ethAddress')}
                 </div>
                 {copied === 'eth' && <span className="text-green-500 text-xs font-bold flex items-center gap-1"><Check size={12}/> {t(uiLanguage, 'copied')}</span>}
              </div>
              <div className="flex gap-2">
                 <code className={`flex-1 p-2 rounded text-xs break-all ${darkMode ? 'bg-black/20' : 'bg-gray-200'}`}>
                    {ETH_ADDRESS}
                 </code>
                 <button onClick={() => handleCopy(ETH_ADDRESS, 'eth')} className="p-2 hover:bg-gray-500/10 rounded">
                    <Copy size={16} />
                 </button>
              </div>
           </div>
           )}
        </div>

        <button onClick={onClose} className={`mt-8 text-sm hover:underline opacity-50`}>
          {t(uiLanguage, 'close')}
        </button>
      </div>
    </div>
  );
};