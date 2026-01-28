import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function UserMenu() {
  const { user, logout, businesses } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleSwitchBusiness(slug: string) {
    setIsOpen(false);
    navigate(`/staff/${slug}`);
  }

  if (!user) return null;

  // Get first letter of email for avatar
  const avatarLetter = user.email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800/50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold text-sm">
          {avatarLetter}
        </div>
        {/* Email (hidden on mobile) */}
        <span className="hidden sm:block text-sm text-zinc-300 max-w-[150px] truncate">
          {user.email}
        </span>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-2 z-50">
          {/* Signed in as header */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Signed in as</p>
            <p className="text-sm text-white font-medium truncate">{user.email}</p>
          </div>

          {/* Business switcher (if multiple businesses) */}
          {businesses.length > 1 && (
            <div className="py-2 border-b border-zinc-800">
              <p className="px-4 py-1 text-xs text-zinc-500 uppercase tracking-wide">Switch business</p>
              {businesses.map((business) => (
                <button
                  key={business.id}
                  onClick={() => handleSwitchBusiness(business.slug)}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  {business.name}
                </button>
              ))}
            </div>
          )}

          {/* Single business link (if only one business) */}
          {businesses.length === 1 && (
            <div className="py-1 border-b border-zinc-800">
              <button
                onClick={() => handleSwitchBusiness(businesses[0].slug)}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {businesses[0].name}
              </button>
            </div>
          )}

          {/* Sign out */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
