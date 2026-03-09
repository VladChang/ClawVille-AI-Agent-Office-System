import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '@/components/sidebar';
import { SummaryBar } from '@/components/summaryBar';
import { AgentDetailDrawer } from '@/components/agentDetailDrawer';
import { AppProviders } from '@/components/providers';

export const metadata: Metadata = {
  title: 'ClawVille 控制台',
  description: 'AI Agent 辦公室系統儀表板'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <AppProviders>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <SummaryBar />
              <main className="flex-1 overflow-auto p-4">{children}</main>
            </div>
            <AgentDetailDrawer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
