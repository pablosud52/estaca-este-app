/// <reference types="vite/client" />

declare module 'ical.js' {
  export interface IcalTimezone {
    tzid?: string;
  }

  export interface IcalTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    isDate?: boolean;
    zone?: IcalTimezone | null;
    toJSDate(): Date;
  }

  export class Timezone implements IcalTimezone {
    constructor(component: Component);
    tzid: string;
    static localTimezone: IcalTimezone;
  }

  export const TimezoneService: {
    register(name: string, timezone: Timezone): void;
  };

  export class Component {
    constructor(jCal: unknown);
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): unknown;
  }

  export interface RecurIterator {
    next(): IcalTime | null;
  }

  export interface OccurrenceDetails {
    recurrenceId: IcalTime;
    item: Event;
    startDate: IcalTime;
    endDate: IcalTime;
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description: string;
    location: string;
    startDate: IcalTime | null;
    endDate: IcalTime | null;
    recurrenceId?: IcalTime | null;
    isRecurring(): boolean;
    isRecurrenceException(): boolean;
    iterator(startTime?: IcalTime): RecurIterator;
    getOccurrenceDetails(occurrence: IcalTime): OccurrenceDetails;
  }

  export function parse(input: string): unknown;

  const ICAL: {
    parse: typeof parse;
    Component: typeof Component;
    Event: typeof Event;
    Timezone: typeof Timezone;
    TimezoneService: typeof TimezoneService;
  };
  export default ICAL;
}
