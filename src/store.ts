import { useRef, useSyncExternalStore } from 'react';
import { generateDataset, type GeneratedDataset } from './data/generator';
import { deriveEvents, type DerivedEvent } from './data/transforms';
import type { Channel } from './types';

type Listener = () => void;

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface FiltersState {
  teams: string[];
  sdrs: string[];
  companies: string[];
  industries: string[];
  channels: Channel[];
}

interface StoreState {
  dataset: GeneratedDataset;
  derivedEvents: DerivedEvent[];
  filteredEvents: DerivedEvent[];
  filters: FiltersState;
  dateRange: DateRange;
  seed: string;
}

interface StoreActions {
  setFilters: (updates: Partial<FiltersState>) => void;
  resetFilters: () => void;
  setDateRange: (range: DateRange) => void;
  reseed: (seed: string | number) => void;
  replaceDataset: (dataset: GeneratedDataset) => void;
}

type StoreSnapshot = StoreState & StoreActions;

const DEFAULT_SEED = 'dashboard-seed';

const createInitialFilters = (): FiltersState => ({
  teams: [],
  sdrs: [],
  companies: [],
  industries: [],
  channels: [],
});

const createInitialDateRange = (): DateRange => ({
  start: null,
  end: null,
});

const toBoundaryTimestamp = (value: string | null, boundary: 'start' | 'end'): number | null => {
  if (!value) {
    return null;
  }

  const isIsoString = value.includes('T');
  const dateString = isIsoString
    ? value
    : `${value}${boundary === 'start' ? 'T00:00:00Z' : 'T23:59:59.999Z'}`;

  const timestamp = new Date(dateString).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const computeFilteredEvents = (
  events: DerivedEvent[],
  filters: FiltersState,
  range: DateRange,
): DerivedEvent[] => {
  if (
    filters.teams.length === 0 &&
    filters.sdrs.length === 0 &&
    filters.industries.length === 0 &&
    filters.channels.length === 0 &&
    !range.start &&
    !range.end
  ) {
    return events;
  }

  const startTime = toBoundaryTimestamp(range.start, 'start');
  const endTime = toBoundaryTimestamp(range.end, 'end');

  return events.filter((event) => {
    if (filters.teams.length > 0 && !filters.teams.includes(event.team)) {
      return false;
    }

    if (filters.sdrs.length > 0 && !filters.sdrs.includes(event.sdr_id)) {
      return false;
    }

    if (filters.companies.length > 0 && !filters.companies.includes(event.company)) {
      return false;
    }

    if (filters.industries.length > 0 && !filters.industries.includes(event.industry)) {
      return false;
    }

    if (filters.channels.length > 0 && !filters.channels.includes(event.channel)) {
      return false;
    }

    const timestamp = new Date(event.timestamp).getTime();

    if (startTime !== null && timestamp < startTime) {
      return false;
    }

    if (endTime !== null && timestamp > endTime) {
      return false;
    }

    return true;
  });
};

class Store {
  private state: StoreState;

  private listeners = new Set<Listener>();

  constructor() {
    const dataset = generateDataset(DEFAULT_SEED);
    const derivedEvents = deriveEvents(dataset.events);
    const filters = createInitialFilters();
    const dateRange = createInitialDateRange();

    this.state = {
      dataset,
      derivedEvents,
      filteredEvents: computeFilteredEvents(derivedEvents, filters, dateRange),
      filters,
      dateRange,
      seed: dataset.seed,
    };
  }

  getState(): StoreSnapshot {
    return {
      ...this.state,
      setFilters: this.setFilters,
      resetFilters: this.resetFilters,
      setDateRange: this.setDateRange,
      reseed: this.reseed,
      replaceDataset: this.replaceDataset,
    };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private updateState(partial: Partial<StoreState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private setFilters = (updates: Partial<FiltersState>) => {
    const filters: FiltersState = {
      ...this.state.filters,
      ...updates,
    };
    const filteredEvents = computeFilteredEvents(this.state.derivedEvents, filters, this.state.dateRange);
    this.updateState({ filters, filteredEvents });
  };

  private resetFilters = () => {
    const filters = createInitialFilters();
    const dateRange = createInitialDateRange();
    const filteredEvents = computeFilteredEvents(this.state.derivedEvents, filters, dateRange);
    this.updateState({ filters, dateRange, filteredEvents });
  };

  private setDateRange = (range: DateRange) => {
    const nextRange: DateRange = {
      start: range.start ?? null,
      end: range.end ?? null,
    };
    const filteredEvents = computeFilteredEvents(this.state.derivedEvents, this.state.filters, nextRange);
    this.updateState({ dateRange: nextRange, filteredEvents });
  };

  private reseed = (seed: string | number) => {
    const dataset = generateDataset(seed);
    const derivedEvents = deriveEvents(dataset.events);
    const filters = createInitialFilters();
    const dateRange = createInitialDateRange();
    const filteredEvents = computeFilteredEvents(derivedEvents, filters, dateRange);
    this.updateState({ dataset, derivedEvents, filters, dateRange, filteredEvents, seed: dataset.seed });
  };

  private replaceDataset = (dataset: GeneratedDataset) => {
    const derivedEvents = deriveEvents(dataset.events);
    const filters = createInitialFilters();
    const dateRange = createInitialDateRange();
    const filteredEvents = computeFilteredEvents(derivedEvents, filters, dateRange);
    this.updateState({ dataset, derivedEvents, filters, dateRange, filteredEvents, seed: dataset.seed });
  };
}

const store = new Store();

export const shallowEqual = <T extends Record<string, unknown>>(a: T, b: T) => {
  if (a === b) {
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

export const useStore = <T,>(
  selector: (state: StoreSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T => {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(isEqual);
  const cachedValueRef = useRef<T>();
  const hasCachedValueRef = useRef(false);

  if (selectorRef.current !== selector) {
    selectorRef.current = selector;
    hasCachedValueRef.current = false;
  }

  if (equalityRef.current !== isEqual) {
    equalityRef.current = isEqual;
    hasCachedValueRef.current = false;
  }

  return useSyncExternalStore(
    store.subscribe,
    () => {
      const snapshot = store.getState();
      const selected = selectorRef.current(snapshot);

      if (hasCachedValueRef.current && equalityRef.current(cachedValueRef.current as T, selected)) {
        return cachedValueRef.current as T;
      }

      cachedValueRef.current = selected;
      hasCachedValueRef.current = true;
      return selected;
    },
    () => selectorRef.current(store.getState()),
  );
};

export const getStore = () => store;

