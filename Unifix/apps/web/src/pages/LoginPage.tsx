import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import { Building2, ArrowRight, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';

interface CampusOption {
  id: string;
  name: string;
  code: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [campuses, setCampuses] = useState<CampusOption[]>([
    { id: 'campus-pstc-01', name: 'Pacific Science & Tech Campus', code: 'PSTC' },
    { id: 'campus-madi-02', name: 'Metropolitan Arts & Design Institute', code: 'MADI' },
    { id: 'campus-hvu-03', name: 'Highland Valley University', code: 'HVU' },
  ]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('campus-pstc-01');

  const [identifier, setIdentifier] = useState<string>('manager.sarah@pstc.test');
  const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
  const [otpCode, setOtpCode] = useState<string>('123456');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampuses() {
      try {
        const res = await ApiClient.getCampuses();
        if (res.data && res.data.length > 0) {
          setCampuses(res.data);
          setSelectedCampusId(res.data[0].id);
        }
      } catch (err: any) {
        setError('Failed to load campuses from server. Ensure backend is running.');
      }
    }
    fetchCampuses();
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampusId || !identifier) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await ApiClient.requestOTP(identifier, selectedCampusId);
      if (res.data?.developmentOtpCode) {
        setDevOtpHint(res.data.developmentOtpCode);
        setOtpCode(res.data.developmentOtpCode);
      }
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Identity not authorized for this campus.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, otpCode, selectedCampusId);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickDemo = (email: string, campusCode: string) => {
    const campus = campuses.find((c) => c.code === campusCode);
    if (campus) {
      setSelectedCampusId(campus.id);
      setIdentifier(email);
      setStep('identifier');
      setOtpCode('123456');
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-md">
            U
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">
          Unifix Campus Management
        </h2>
        <p className="mt-1 text-center text-xs text-gray-500">
          Multi-campus facility operations & lifecycle escalation portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card p-8 bg-white shadow-sm border border-gray-200/80 rounded-2xl">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {step === 'identifier' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Campus</label>
                <div className="relative">
                  <select
                    value={selectedCampusId}
                    onChange={(e) => setSelectedCampusId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Authorized Email or Phone
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. manager.sarah@pstc.test"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 text-sm mt-2"
              >
                {isSubmitting ? 'Checking Eligibility...' : 'Continue to Verification'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-900">
                  <span className="font-semibold">Simulated Verification:</span> Enter the 6-digit code for{' '}
                  <span className="font-medium underline">{identifier}</span>.
                  {devOtpHint && (
                    <div className="mt-1 font-mono text-[11px] font-bold text-blue-700">
                      Development Code: {devOtpHint}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">6-Digit Code</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-9 pr-4 py-2 text-center font-mono tracking-widest text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 text-sm mt-2"
              >
                {isSubmitting ? 'Signing In...' : 'Verify & Enter Management Portal'}
                <CheckCircle2 className="w-4 h-4 ml-1" />
              </button>

              <button
                type="button"
                onClick={() => setStep('identifier')}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 mt-2"
              >
                Back to change campus or email
              </button>
            </form>
          )}

          {/* Development Quick-Fill Accounts */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Development Quick-Fill Profiles
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => fillQuickDemo('manager.sarah@pstc.test', 'PSTC')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 flex justify-between items-center transition-colors"
              >
                <span>Sarah Jenkins (Facilities Lead)</span>
                <span className="text-[10px] text-blue-600 font-medium">PSTC Mgt</span>
              </button>
              <button
                type="button"
                onClick={() => fillQuickDemo('director.kiran@unifix.global', 'PSTC')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 flex justify-between items-center transition-colors"
              >
                <span>Kiran Patel (Operations Director)</span>
                <span className="text-[10px] text-purple-600 font-medium">Supermanagement</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
