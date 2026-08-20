'use client';

import React, { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { Users, FileText, ChevronDown, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface NavbarProps {
  currentUser?: User | null;
  onUserSwitch?: (user: User) => void;
  showBackToDashboard?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onUserSwitch, showBackToDashboard }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(currentUser || null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data.users) setUsers(data.users);
        if (data.currentUser && !currentUser) {
          setActiveUser(data.currentUser);
        }
      })
      .catch(err => console.error('Failed to load users:', err));
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setActiveUser(currentUser);
    }
  }, [currentUser]);

  const handleSwitchUser = async (user: User) => {
    setLoading(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setActiveUser(user);
      setIsOpen(false);
      if (onUserSwitch) {
        onUserSwitch(user);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight text-base flex items-center gap-1.5">
            Ajaia Docs
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
              Pro
            </span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* User Simulation & Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-slate-50/80 hover:bg-slate-100/80 transition-all text-xs font-medium text-slate-700 shadow-2xs"
            title="Switch Simulated User Session"
          >
            <div
              className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
              style={{ backgroundColor: activeUser?.color || '#2563eb' }}
            >
              {activeUser?.avatar || 'U'}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-semibold text-slate-800 leading-tight">
                {activeUser?.name || 'Loading user...'}
              </span>
              <span className="text-[10px] text-slate-500 font-normal leading-none">
                {activeUser?.role_title || activeUser?.email}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> Switch Profile
                    </span>
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-normal">
                      Multi-User Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Simulate permissions and live sharing between team members.
                  </p>
                </div>

                <div className="p-1 space-y-0.5">
                  {users.map(u => {
                    const isSelected = activeUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        disabled={loading}
                        onClick={() => handleSwitchUser(u)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 text-blue-900 font-medium'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: u.color }}
                          >
                            {u.avatar}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-800 leading-tight">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              {u.role_title} • {u.email}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
