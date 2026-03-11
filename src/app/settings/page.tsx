"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Eye, EyeOff, Save, Check, Info, Github, Database, Code } from "lucide-react";

interface SettingsState {
  aiProvider: "anthropic" | "openai" | "google";
  apiKey: string;
  defaultView: "annual" | "quarterly";
  defaultCategory: "all" | "large_commercial" | "reinsurer" | "auto_dealer_niche";
}

const DEFAULT_SETTINGS: SettingsState = {
  aiProvider: "google",
  apiKey: "",
  defaultView: "annual",
  defaultCategory: "all",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("insureIntelSettings");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SettingsState>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleSave() {
    try {
      localStorage.setItem("insureIntelSettings", JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore storage errors
    }
  }

  function updateSetting<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure AI integration, data preferences, and application settings.
        </p>
      </div>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Configuration
          </CardTitle>
          <CardDescription>
            Configure your AI provider for automated comparison analysis. The API key is stored
            locally in your browser and never sent to our servers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Provider</label>
            <select
              value={settings.aiProvider}
              onChange={(e) =>
                updateSetting("aiProvider", e.target.value as "anthropic" | "openai" | "google")
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="google">Google (Gemini) — Free Tier</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Select which AI provider to use for generating comparison analyses.
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => updateSetting("apiKey", e.target.value)}
                placeholder={
                  settings.aiProvider === "google"
                    ? "AIza..."
                    : settings.aiProvider === "anthropic"
                      ? "sk-ant-api03-..."
                      : "sk-..."
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings.apiKey
                ? "API key is set. It will be used for auto-generating comparison analyses."
                : "No API key set. You can still use the manual copy/paste workflow on the Compare page."}
            </p>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">How AI Analysis Works</p>
              <p className="mt-1">
                With an API key configured, AI-powered features are enabled across the app:
                Filing Analysis can auto-analyze year-over-year changes, and Theme Tracking can
                scan across all carriers for emerging industry trends. We recommend Google Gemini
                (free tier: 15 requests/minute, 1,500/day). Get your key at{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  aistudio.google.com/apikey
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Preferences
          </CardTitle>
          <CardDescription>
            Set default filters and display options across the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default View */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Financial View</label>
            <select
              value={settings.defaultView}
              onChange={(e) =>
                updateSetting("defaultView", e.target.value as "annual" | "quarterly")
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="annual">Annual (10-K filings)</option>
              <option value="quarterly">Quarterly (10-Q filings)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Choose whether to show annual or quarterly financial data by default.
            </p>
          </div>

          {/* Default Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Category Filter</label>
            <select
              value={settings.defaultCategory}
              onChange={(e) =>
                updateSetting(
                  "defaultCategory",
                  e.target.value as SettingsState["defaultCategory"]
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              <option value="large_commercial">Large Commercial</option>
              <option value="reinsurer">Reinsurers</option>
              <option value="auto_dealer_niche">Auto Dealer Niche</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Set the default carrier category filter on the Carrier Universe page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            About InsureIntel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">v0.2.0</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-medium">Development</p>
              </div>
              <div>
                <p className="text-muted-foreground">Database</p>
                <p className="font-medium">SQLite (Prisma ORM)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Framework</p>
                <p className="font-medium">Next.js 16 + React 19</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">Tech Stack</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "Next.js",
                  "React",
                  "TypeScript",
                  "Prisma",
                  "Tailwind CSS",
                  "shadcn/ui",
                  "Recharts",
                  "Lucide Icons",
                ].map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <a
                href="https://github.com/Indredd13/insure-intel"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button — Fixed at bottom */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
