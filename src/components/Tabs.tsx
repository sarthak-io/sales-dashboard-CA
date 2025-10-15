import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export type TabDefinition = {
  id: string;
  label: string;
  content: ReactNode;
  description?: string;
};

type TabsProps = {
  tabs: TabDefinition[];
  defaultTab: string;
};

const isBrowser = typeof window !== 'undefined';

const getHashValue = () => {
  if (!isBrowser) {
    return '';
  }

  return window.location.hash.replace('#', '');
};

const Tabs = ({ tabs, defaultTab }: TabsProps) => {
  const validTabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);

  const resolveInitialTab = useCallback(() => {
    const hash = getHashValue();
    if (hash && validTabIds.has(hash)) {
      return hash;
    }

    if (validTabIds.has(defaultTab)) {
      return defaultTab;
    }

    return tabs[0]?.id ?? '';
  }, [defaultTab, tabs, validTabIds]);

  const [activeTab, setActiveTab] = useState<string>(() => resolveInitialTab());

  const updateHash = useCallback(
    (tabId: string) => {
      if (!isBrowser || !tabId) {
        return;
      }

      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', `${base}#${tabId}`);
    },
    [],
  );

  const syncWithHash = useCallback(() => {
    if (!isBrowser) {
      return;
    }

    const hash = getHashValue();
    if (hash && validTabIds.has(hash)) {
      setActiveTab(hash);
      return;
    }

    const fallback = resolveInitialTab();
    setActiveTab(fallback);

    if (!hash || hash !== fallback) {
      updateHash(fallback);
    }
  }, [resolveInitialTab, updateHash, validTabIds]);

  useEffect(() => {
    syncWithHash();
    if (!isBrowser) {
      return;
    }

    window.addEventListener('hashchange', syncWithHash);
    return () => window.removeEventListener('hashchange', syncWithHash);
  }, [syncWithHash]);

  const handleSelect = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      updateHash(tabId);
    },
    [updateHash],
  );

  const activeContent = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.content ?? null,
    [activeTab, tabs],
  );

  return (
    <div className="flex flex-col gap-6">
      <nav role="tablist" aria-label="Insights navigation" className="w-full">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                onClick={() => handleSelect(tab.id)}
                title={
                  tab.description
                    ? `${tab.label} — ${tab.description}`
                    : `View ${tab.label} insights`
                }
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:text-base ${
                  isActive
                    ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-600'
                }`}
              >
                <span className="block text-left">{tab.label}</span>
                {tab.description ? (
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">
                    {tab.description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <section
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
        className="space-y-6"
      >
        {activeContent}
      </section>
    </div>
  );
};

export default Tabs;
