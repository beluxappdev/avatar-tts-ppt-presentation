import React, { useState } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isExpanded={sidebarExpanded} onToggle={toggleSidebar} />
      
      <main style={{
        flex: 1,
        marginLeft: sidebarExpanded ? '280px' : '80px',
        transition: 'margin-left 0.3s ease-in-out',
        backgroundColor: '#f8fafc'
      }}>
        {children}
      </main>
    </div>
  );
};