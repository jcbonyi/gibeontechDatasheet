import { ReactNode } from 'react';

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  const isActive = activeTab === id;

  return (
    <div id={id} role="tabpanel" hidden={!isActive} className={!isActive ? 'hidden' : undefined}>
      {children}
    </div>
  );
}
