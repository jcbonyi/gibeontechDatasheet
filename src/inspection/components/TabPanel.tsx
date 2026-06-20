import { ReactNode } from 'react';

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (activeTab !== id) return null;

  return (
    <div id={id} role="tabpanel">
      {children}
    </div>
  );
}
