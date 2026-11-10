/// <reference types="vite/client" />

declare module 'ical.js' {
  export interface IcalTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    isDate?: boolean;
    toJSDate(): Date;
  }

  export class Component {
    constructor(jCal: unknown);
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): unknown;
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description: string;
    location: string;
    startDate: IcalTime | null;
    endDate: IcalTime | null;
  }

  export function parse(input: string): unknown;

  const ICAL: {
    parse: typeof parse;
    Component: typeof Component;
    Event: typeof Event;
  };
  export default ICAL;
}
