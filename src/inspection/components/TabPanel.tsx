import { ReactNode } from 'react';

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  return (
    <div id={id} role="tabpanel" hidden={activeTab !== id} className={activeTab !== id ? 'hidden' : undefined}>
      {children}
    </div>
  );
}
