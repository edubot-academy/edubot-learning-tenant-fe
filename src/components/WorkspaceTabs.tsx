import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

export type WorkspaceTab<T extends string> = {
  key: T;
  label: string;
  description?: string;
};

type WorkspaceTabsProps<T extends string> = {
  tabs: ReadonlyArray<WorkspaceTab<T>>;
  activeTab: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
  className: string;
};

export function WorkspaceTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className,
}: WorkspaceTabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveToTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.key);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
    if (currentIndex < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveToTab((currentIndex + 1) % tabs.length);
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveToTab((currentIndex - 1 + tabs.length) % tabs.length);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveToTab(0);
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveToTab(tabs.length - 1);
    }
  };

  return (
    <section className={className} role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          className={activeTab === tab.key ? 'active' : ''}
          key={tab.key}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          tabIndex={activeTab === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
        >
          {tab.description ? (
            <>
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </>
          ) : (
            tab.label
          )}
        </button>
      ))}
    </section>
  );
}
