"use client";

import { Settings, Users, Copy, Check, Save, Trash2 } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText("ABCD1234");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-fordham-maroon" />
          <h1 className="t-heading text-lg">Settings</h1>
        </div>
        <p className="t-caption t-secondary mt-1">
          Manage your team, members, and saved configurations
        </p>
      </div>

      {/* Team info */}
      <div className="ehr-shell">
        <div className="ehr-shell-header">Team Information</div>
        <div className="space-y-4 p-5">
          <div>
            <label className="t-micro t-secondary uppercase tracking-wider font-medium block mb-1.5">
              Team Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="My Team"
                readOnly
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 t-body outline-none"
              />
              <button
                disabled
                className="rounded-lg border border-gray-200 px-3 py-2 t-small font-medium text-gray-400 cursor-not-allowed"
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="t-micro t-secondary uppercase tracking-wider font-medium block mb-1.5">
              Join Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center justify-between rounded-lg border border-dashed border-fordham-maroon/30 bg-fordham-maroon/5 px-3 py-2">
                <code className="t-body t-mono font-bold tracking-widest text-fordham-maroon">
                  ABCD1234
                </code>
              </div>
              <button
                onClick={handleCopyCode}
                className="rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50"
              >
                {copied ? (
                  <Check size={14} className="text-green-600" />
                ) : (
                  <Copy size={14} className="t-secondary" />
                )}
              </button>
            </div>
            <p className="t-micro t-tertiary mt-1">
              Share this code with teammates so they can join
            </p>
          </div>
        </div>
      </div>

      {/* Team members */}
      <div className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Users size={12} />
          <span>Team Members</span>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {[
              {
                name: "You",
                email: "you@fordham.edu",
                role: "Lead",
                joined: "Mar 2, 2026",
              },
            ].map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fordham-maroon/10">
                    <span className="t-small font-semibold text-fordham-maroon">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="t-body font-medium">{member.name}</p>
                    <p className="t-caption t-secondary">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-fordham-maroon/10 px-2.5 py-0.5 t-micro font-medium text-fordham-maroon">
                    {member.role}
                  </span>
                  <span className="t-caption t-tertiary">{member.joined}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="t-caption t-tertiary mt-3">
            Additional team members will appear here when they join using the
            invite code
          </p>
        </div>
      </div>

      {/* Saved configurations */}
      <div className="ehr-shell">
        <div className="ehr-shell-header flex items-center justify-between">
          <span>Saved Configurations</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 t-micro t-tertiary normal-case">
            0 configs
          </span>
        </div>
        <div className="p-5">
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-200">
            <div className="text-center">
              <p className="t-small t-tertiary">No saved configurations yet</p>
              <p className="t-caption t-tertiary mt-1">
                Save a configuration from the Workspace to see it here
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="ehr-shell border-red-200">
        <div className="ehr-shell-header text-red-600 bg-red-50/50">
          Danger Zone
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="t-body font-medium">Leave Team</p>
              <p className="t-caption t-secondary">
                Remove yourself from this team. This action cannot be undone.
              </p>
            </div>
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 t-small font-medium text-red-500 cursor-not-allowed opacity-60"
            >
              <Trash2 size={14} />
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
