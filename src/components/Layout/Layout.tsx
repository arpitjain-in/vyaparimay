import React from 'react';
import Sidebar from './Sidebar';

interface Props {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export default function Layout({ children, title, actions }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
