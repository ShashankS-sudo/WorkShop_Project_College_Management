import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import {
  ShieldAlert,
  Building2,
  Sparkles,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';

interface CampusComparison {
  id: string;
  name: string;
  code: string;
  totalTickets: number;
  activeTickets: number;
  overdueTickets: number;
  registeredUsers: number;
}

interface GlobalSummary {
  totalCampuses: number;
  totalTickets: number;
  activeTickets: number;
  criticalTickets: number;
  overdueTickets: number;
}

interface AIInsight {
  title: string;
  observedFacts: string[];
  recommendations: string[];
  affectedCampuses: string[];
  confidence: number;
  generatedAt: string;
}

export const SupermanagementPage: React.FC = () => {
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [campusComparison, setCampusComparison] = useState<CampusComparison[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobalData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, insightsRes] = await Promise.all([
        ApiClient.getGlobalOverview(),
        ApiClient.getAiInsights(),
      ]);

      if (overviewRes.data) {
        setSummary(overviewRes.data.summary);
        setCampusComparison(overviewRes.data.campusComparison);
      }
      if (insightsRes.data?.insights) {
        setInsights(insightsRes.data.insights);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load supermanagement data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  if (isLoading && !summary) {
    return (
      <div className="p-12 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
        Loading global multi-campus oversight...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Global Supermanagement
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enterprise multi-campus governance, comparative performance, and AI maintenance insights
          </p>
        </div>
        <button
          onClick={fetchGlobalData}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Global Data
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl">{error}</div>}

      {/* Global Totals Row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Campuses</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.totalCampuses}</div>
          </div>
          <div className="card p-4">
            <span className="text-xs font-semibold text-gray-500 uppercase">Global Volume</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.totalTickets}</div>
          </div>
          <div className="card p-4">
            <span className="text-xs font-semibold text-blue-600 uppercase">Active Backlog</span>
            <div className="text-2xl font-bold text-blue-900 mt-1">{summary.activeTickets}</div>
          </div>
          <div className="card p-4">
            <span className="text-xs font-semibold text-red-600 uppercase">Critical Safety</span>
            <div className="text-2xl font-bold text-red-900 mt-1">{summary.criticalTickets}</div>
          </div>
          <div className="card p-4 bg-purple-50/50 border-purple-200">
            <span className="text-xs font-semibold text-purple-700 uppercase">21-Day Overdue</span>
            <div className="text-2xl font-bold text-purple-900 mt-1">{summary.overdueTickets}</div>
          </div>
        </div>
      )}

      {/* AI-Assisted Insights Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">AI Operational Insights</h2>
          <span className="badge badge-overdue text-[10px]">On-demand Inference</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins, i) => (
            <div key={i} className="card p-5 bg-gradient-to-br from-white to-purple-50/20 border-purple-100">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {ins.title}
                </h3>
                <span className="badge badge-overdue text-[10px]">
                  {Math.round(ins.confidence * 100)}% Confidence
                </span>
              </div>

              {/* Observed Facts */}
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Observed Facts:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                  {ins.observedFacts.map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>

              {/* AI Recommendations */}
              <div className="mt-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block mb-1">
                  AI Recommendation:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-purple-950 font-medium">
                  {ins.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
                <span>Campuses: {ins.affectedCampuses.join(', ')}</span>
                <span>Generated {new Date(ins.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campus Comparative Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-600" />
          Campus Performance Comparison
        </h2>

        <div className="card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Campus Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Total Issues</th>
                <th className="py-3 px-4">Active Backlog</th>
                <th className="py-3 px-4">21-Day Overdue</th>
                <th className="py-3 px-4">Registered Members</th>
                <th className="py-3 px-4 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campusComparison.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{c.name}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{c.code}</td>
                  <td className="py-3.5 px-4 font-medium">{c.totalTickets}</td>
                  <td className="py-3.5 px-4 font-semibold text-blue-700">{c.activeTickets}</td>
                  <td className="py-3.5 px-4 font-semibold text-purple-700">
                    {c.overdueTickets > 0 ? (
                      <span className="badge badge-overdue">{c.overdueTickets} Overdue</span>
                    ) : (
                      <span className="text-emerald-600 font-medium">0 Overdue</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">{c.registeredUsers}</td>
                  <td className="py-3.5 px-4 text-right">
                    {c.overdueTickets > 3 ? (
                      <span className="badge badge-critical">Attention Needed</span>
                    ) : c.overdueTickets > 0 ? (
                      <span className="badge badge-high">Monitor Closely</span>
                    ) : (
                      <span className="badge badge-resolved">Healthy</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
