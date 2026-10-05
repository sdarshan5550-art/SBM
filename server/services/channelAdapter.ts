export * from './adapters/baseAdapter';
export * from './adapters/directWebsiteAdapter';
export * from './adapters/bookingComAdapter';
export * from './adapters/mmtAdapter';
export * from './adapters/goibiboAdapter';
export * from './adapters/agodaAdapter';
export * from './adapters/expediaAdapter';
export * from './adapters/ctripAdapter';
export * from './adapters/cleartripAdapter';
export * from './adapters/genericOtaAdapter';

import { ChannelCode } from '../../src/types';
import { ChannelAdapter } from './adapters/baseAdapter';
import { DirectWebsiteAdapter } from './adapters/directWebsiteAdapter';
import { BookingComAdapter } from './adapters/bookingComAdapter';
import { MakeMyTripAdapter } from './adapters/mmtAdapter';
import { GoibiboAdapter } from './adapters/goibiboAdapter';
import { AgodaAdapter } from './adapters/agodaAdapter';
import { ExpediaAdapter } from './adapters/expediaAdapter';
import { CtripAdapter } from './adapters/ctripAdapter';
import { CleartripAdapter } from './adapters/cleartripAdapter';
import { GenericOTAAdapter } from './adapters/genericOtaAdapter';

// Global adapter registry for all supported channels
const adapterRegistry: Map<ChannelCode, ChannelAdapter> = new Map([
  ['DIRECT', new DirectWebsiteAdapter()],
  ['BOOKING_COM', new BookingComAdapter()],
  ['MMT', new MakeMyTripAdapter()],
  ['GOIBIBO', new GoibiboAdapter()],
  ['AGODA', new AgodaAdapter()],
  ['EXPEDIA', new ExpediaAdapter()],
  ['CTRIP', new CtripAdapter()],
  ['CLEARTRIP', new CleartripAdapter()],
  ['OTHER', new GenericOTAAdapter()]
]);

export function getChannelAdapter(channelCode: ChannelCode): ChannelAdapter {
  const adapter = adapterRegistry.get(channelCode);
  if (!adapter) {
    return new GenericOTAAdapter();
  }
  return adapter;
}
