"use client";

import { useState, useEffect } from 'react';
import {
  Database,
  FolderSync,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Cloud,
  Activity,
  ChevronRight,
  FileText,
  Download
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DriveStatus {
  status: string;
  sync?: {
    initialized: boolean;
    lastUpdated: string;
    createdAt: string;
    targetFolders: number;
    targetFolderIds: string[];
  };
  channel?: {
    status: 'active' | 'expired' | 'none';
    channelId?: string;
    expiration?: string;
    expiresIn?: string;
    needsRenewal?: boolean;
  };
  events?: {
    total: number;
    last24Hours: number;
    downloaded: number;
    latest?: {
      file_name: string;
      event_type: string;
      detected_at: string;
    };
  };
  recommendations?: string[];
}

interface TableStatus {
  status: string;
  driveTables?: string[];
  hasRequiredTables?: boolean;
  message?: string;
}

export default function DriveSettingsPage() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [tableStatus, setTableStatus] = useState<TableStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [folderIds, setFolderIds] = useState('');
  const [pollingActive, setPollingActive] = useState(false);
  const [mode, setMode] = useState<'polling' | 'webhook'>('polling');
  const [pollingInterval, setPollingInterval] = useState(30); // seconds
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number | null>(null);

  useEffect(() => {
    checkStatus();
    checkTables();
    // Load folder IDs from env if available
    const envFolderIds = process.env.NEXT_PUBLIC_DRIVE_TARGET_FOLDER_IDS;
    if (envFolderIds && !folderIds) {
      setFolderIds(envFolderIds);
    }
  }, []);

  // Continuous polling effect
  useEffect(() => {
    if (!pollingActive) {
      setNextPollIn(null);
      return;
    }

    // Initial poll
    pollForChanges();

    // Set up interval
    const pollIntervalId = setInterval(() => {
      pollForChanges();
    }, pollingInterval * 1000);

    // Countdown timer
    const countdownId = setInterval(() => {
      if (lastPollTime) {
        const elapsed = Math.floor((Date.now() - lastPollTime.getTime()) / 1000);
        const remaining = pollingInterval - elapsed;
        setNextPollIn(remaining > 0 ? remaining : 0);
      }
    }, 1000);

    return () => {
      clearInterval(pollIntervalId);
      clearInterval(countdownId);
    };
  }, [pollingActive, pollingInterval]);

  const pollForChanges = async () => {
    try {
      const res = await apiFetch('/api/drive/poll', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setLastPollTime(new Date());
        // Silently update status, don't show success message for continuous polling
        await checkStatus();
      }
    } catch (err: any) {
      console.error('Poll error:', err);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await apiFetch('/api/drive/status');
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to check status:', err);
    }
  };

  const checkTables = async () => {
    try {
      const res = await apiFetch('/api/drive/init-tables');
      const data = await res.json();
      setTableStatus(data);
    } catch (err: any) {
      console.error('Failed to check tables:', err);
    }
  };

  const createTables = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/drive/init-tables', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Database tables created successfully!');
        await checkTables();
      } else {
        setError(data.error || 'Failed to create tables');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create tables');
    } finally {
      setLoading(false);
    }
  };

  const initializeSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const url = folderIds
        ? `/api/drive/init?folderIds=${encodeURIComponent(folderIds)}`
        : '/api/drive/init';

      const res = await apiFetch(url);
      const data = await res.json();

      if (res.ok) {
        setSuccess('Sync initialized successfully!');
        await checkStatus();
      } else {
        setError(data.error || 'Failed to initialize sync');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize sync');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/drive/poll', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setSuccess(`Poll complete! Processed ${data.changesProcessed} changes, ${data.filesLogged} files logged.`);
        await checkStatus();
      } else {
        setError(data.error || 'Failed to poll');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to poll');
    } finally {
      setLoading(false);
    }
  };

  const toggleContinuousPolling = () => {
    if (pollingActive) {
      setPollingActive(false);
      setSuccess('Continuous polling stopped');
    } else {
      setPollingActive(true);
      setLastPollTime(new Date());
      setSuccess(`Continuous polling started (every ${pollingInterval}s)`);
    }
  };

  const startWebhook = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/drive/watch', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Webhook channel registered successfully!');
        await checkStatus();
      } else {
        setError(data.error || 'Failed to register webhook');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register webhook');
    } finally {
      setLoading(false);
    }
  };

  const stopWebhook = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/drive/stop', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Webhook channel stopped!');
        await checkStatus();
      } else {
        setError(data.error || 'Failed to stop webhook');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop webhook');
    } finally {
      setLoading(false);
    }
  };

  const resetSync = async () => {
    if (!confirm('Are you sure you want to reset the sync? This will reinitialize the page token.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/drive/init?reset=true');
      const data = await res.json();

      if (res.ok) {
        setSuccess('Sync reset successfully!');
        await checkStatus();
      } else {
        setError(data.error || 'Failed to reset sync');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset sync');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Cloud className="w-8 h-8 text-blue-600" />
            Google Drive Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and sync Google Drive folders for file changes
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 font-medium">Success</p>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step 1: Database Setup */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Database Setup</h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Create the required database tables for Drive monitoring.
            </p>

            <div className="space-y-3">
              {tableStatus === null ? (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500">Checking tables...</p>
                </div>
              ) : tableStatus?.hasRequiredTables ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Tables created ✓</span>
                  </div>
                  <div className="p-3 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-2">Existing Tables:</p>
                    <ul className="space-y-1">
                      {tableStatus.driveTables?.map(table => (
                        <li key={table} className="text-xs text-green-600 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          {table}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <button
                  onClick={createTables}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Database className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Create Tables'}
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Initialize Sync */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Initialize Sync</h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Set up page token and target folders from environment variables.
            </p>

            <div className="space-y-3">
              {status?.sync?.initialized && status.sync.targetFolderIds && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-3">
                  <p className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Configured Folders ({status.sync.targetFolders})
                  </p>
                  <ul className="space-y-1">
                    {status.sync.targetFolderIds.map((folderId, idx) => (
                      <li key={idx} className="text-xs text-green-700 font-mono bg-green-100 px-2 py-1 rounded">
                        {folderId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder IDs {status?.sync?.initialized && '(override)'}
                </label>
                <input
                  type="text"
                  value={folderIds}
                  onChange={(e) => setFolderIds(e.target.value)}
                  placeholder="folder_id_1,folder_id_2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {status?.sync?.initialized
                    ? 'Leave blank to keep current folders'
                    : 'Leave blank to use DRIVE_TARGET_FOLDER_IDS from .env.local'}
                </p>
              </div>

              {status?.sync?.initialized ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Sync initialized ✓</span>
                  </div>
                  <button
                    onClick={resetSync}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Sync
                  </button>
                </div>
              ) : (
                <button
                  onClick={initializeSync}
                  disabled={loading || !tableStatus?.hasRequiredTables}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FolderSync className="w-4 h-4" />
                  {loading ? 'Initializing...' : 'Initialize Sync'}
                </button>
              )}
            </div>
          </div>

          {/* Step 3: Choose Mode */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Monitoring Mode</h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Choose how to monitor Drive changes.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('polling')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    mode === 'polling'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Activity className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">Polling Mode</p>
                  <p className="text-xs mt-1">No tunnel needed</p>
                </button>

                <button
                  onClick={() => setMode('webhook')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    mode === 'webhook'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Cloud className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">Webhook Mode</p>
                  <p className="text-xs mt-1">Real-time</p>
                </button>
              </div>

              {mode === 'polling' ? (
                <div className="space-y-3">
                  {/* Polling Interval Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Poll Interval
                    </label>
                    <select
                      value={pollingInterval}
                      onChange={(e) => setPollingInterval(Number(e.target.value))}
                      disabled={pollingActive}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={10}>Every 10 seconds</option>
                      <option value={30}>Every 30 seconds</option>
                      <option value={60}>Every 1 minute</option>
                      <option value={120}>Every 2 minutes</option>
                      <option value={300}>Every 5 minutes</option>
                    </select>
                  </div>

                  {/* Continuous Polling Toggle */}
                  <button
                    onClick={toggleContinuousPolling}
                    disabled={!status?.sync?.initialized}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      pollingActive
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {pollingActive ? (
                      <>
                        <StopCircle className="w-4 h-4" />
                        Stop Continuous Polling
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4" />
                        Start Continuous Polling
                      </>
                    )}
                  </button>

                  {/* Polling Status */}
                  {pollingActive && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                        <p className="text-sm font-medium text-green-900">Polling Active</p>
                      </div>
                      {lastPollTime && (
                        <p className="text-xs text-green-700">
                          Last poll: {lastPollTime.toLocaleTimeString()}
                        </p>
                      )}
                      {nextPollIn !== null && nextPollIn > 0 && (
                        <p className="text-xs text-green-700">
                          Next poll in: {nextPollIn}s
                        </p>
                      )}
                    </div>
                  )}

                  {/* Manual Poll Button */}
                  <button
                    onClick={startPolling}
                    disabled={loading || !status?.sync?.initialized}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {loading ? 'Polling...' : 'Poll Once Now'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {status?.channel?.status === 'active' ? (
                    <button
                      onClick={stopWebhook}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <StopCircle className="w-4 h-4" />
                      Stop Webhook
                    </button>
                  ) : (
                    <button
                      onClick={startWebhook}
                      disabled={loading || !status?.sync?.initialized}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <PlayCircle className="w-4 h-4" />
                      {loading ? 'Starting...' : 'Start Webhook'}
                    </button>
                  )}
                  {!process.env.NEXT_PUBLIC_DRIVE_WEBHOOK_BASE_URL && (
                    <p className="text-xs text-yellow-600 text-center">
                      ⚠️ DRIVE_WEBHOOK_BASE_URL not configured in .env.local
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Status
              </h2>
              <button
                onClick={checkStatus}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {status ? (
              <div className="space-y-4">
                {/* Sync Status */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Sync State</p>
                  <div className="flex items-center gap-2">
                    {status.sync?.initialized ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-900">
                          {status.sync.targetFolders} folder{status.sync.targetFolders !== 1 ? 's' : ''} monitored
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Not initialized</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Channel Status */}
                {status.channel && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Channel Status</p>
                    <div className="flex items-center gap-2">
                      {status.channel.status === 'active' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-900">
                            Active (expires {status.channel.expiresIn})
                          </span>
                        </>
                      ) : status.channel.status === 'expired' ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-gray-900">Expired</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">No active channel</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Events Stats */}
                {status.events && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-3">Events</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{status.events.total}</p>
                        <p className="text-xs text-gray-600">Total</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{status.events.last24Hours}</p>
                        <p className="text-xs text-gray-600">Last 24h</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{status.events.downloaded}</p>
                        <p className="text-xs text-gray-600">Downloaded</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Latest Event */}
                {status.events?.latest && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Latest Event
                    </p>
                    <p className="text-sm text-blue-800">{status.events.latest.file_name}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {status.events.latest.event_type} • {new Date(status.events.latest.detected_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Recommendations */}
                {status.recommendations && status.recommendations.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-900 mb-2">Recommendations</p>
                    <ul className="space-y-1">
                      {status.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-yellow-800 flex items-start gap-2">
                          <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Loading status...</p>
              </div>
            )}
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Need help?</strong> Check out the documentation:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-800">
            <li>• <code className="bg-blue-100 px-1 rounded">DRIVE_QUICK_START.md</code> - Quick setup guide</li>
            <li>• <code className="bg-blue-100 px-1 rounded">DRIVE_POLLING_SETUP.md</code> - Polling mode details</li>
            <li>• <code className="bg-blue-100 px-1 rounded">DRIVE_WEBHOOK_GUIDE.md</code> - Complete reference</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
