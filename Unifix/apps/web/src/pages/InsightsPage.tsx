import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import { Sparkles, Lightbulb, RefreshCw, AlertCircle } from 'lucide-react';

export const InsightsPage: React.FC = () => {
  const { activeCampus } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchInsights = async () => {
    if (!activeCampus) return;
    setIsLoading(true);
    try {
      const res = await ApiClient.getAiInsights(activeCampus.id);
      if (res.data) {
        setInsights(res.data.insights || []);
      }
    } catch (err) {
      console.error('Failed to load insights', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [activeCampus]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              AI Facility Insights & Recommendations
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Synthesized maintenance patterns for {activeCampus?.name}
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerate Insights
        </button>
      </div>

      {/* Observational Notice */}
      <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-purple-900">
          <span className="font-bold">Architectural Principle:</span> Unifix AI recommendations are
          advisory only. They separate strictly verified database figures from LLM interpretations and
          never perform automatic reassignments or ticket closures.
        </div>
      </div>

      {/* Insights Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
          Analyzing campus operational data...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((ins, i) => (
            <div key={i} className="card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  {ins.title}
                </h3>
                <span className="badge badge-overdue text-[10px]">
                  {Math.round(ins.confidence * 100)}% Confidence
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Observed Database Facts:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                  {ins.observedFacts?.map((f: string, idx: number) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block mb-1">
                  Proposed Management Action:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-purple-950 font-medium">
                  {ins.recommendations?.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="text-[10px] text-gray-400 pt-2 border-t flex justify-between">
                <span>Model: {ins.modelUsed}</span>
                <span>Generated: {new Date(ins.generatedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
