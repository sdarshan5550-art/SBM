import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode } from '../../../src/types';

/**
 * Generic / Custom OTA & GDS Adapter
 * Fallback adapter for custom channels, metasearch engines, or direct corporate bridges.
 */
export class GenericOTAAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'OTHER';
  public channelName: string = 'Custom OTA / GDS Bridge';
}
