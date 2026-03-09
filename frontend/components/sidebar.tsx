'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '總覽' },
  { href: '/agents', label: '代理人' },
  { href: '/tasks', label: '任務' },
  { href: '/events', label: '事件' },
  { href: '/analytics', label: '分析' },
  { href: '/office', label: '辦公室' }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900/80 p-4">
      <p className="mb-6 text-sm font-semibold text-cyan-300">ClawVille 控制台</p>
      <nav className="space-y-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                active ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
