import type { PhoneBrand } from '@/tracking/battery-optimization';

import { batteryTips } from '../battery-tips';

const brands: PhoneBrand[] = ['xiaomi', 'samsung', 'huawei', 'oneplus', 'oppo', 'vivo', 'other'];

describe('batteryTips', () => {
  it.each(brands)('has steps and a help link for %s', (brand) => {
    const { steps, moreHelpUrl } = batteryTips(brand);
    expect(steps.length).toBeGreaterThan(0);
    expect(moreHelpUrl).toMatch(/^https:\/\/dontkillmyapp\.com/);
  });

  it("covers Xiaomi's own switches, not just Android's", () => {
    const steps = batteryTips('xiaomi').steps.join(' ');
    expect(steps).toMatch(/Autostart/);
    expect(steps).toMatch(/No restrictions/);
  });
});
