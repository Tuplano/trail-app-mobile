import type { PhoneBrand } from '@/tracking/battery-optimization';

/**
 * Where to tap, in the words each phone uses. Menu names differ between
 * Android versions, so each list ends with a link to the brand's page on
 * dontkillmyapp.com, which is kept up to date.
 */
const TIPS: Record<PhoneBrand, string[]> = {
  xiaomi: [
    'Turn on Autostart.',
    'Tap Battery saver (or Battery) and choose No restrictions.',
    'Optional: in recent apps, long-press Trail and tap the lock icon.',
  ],
  samsung: [
    'Choose Trail and set it to Unrestricted (or Don\'t optimize).',
    'Also check Settings → Battery → Background usage limits: Trail should not be in Sleeping apps.',
  ],
  huawei: [
    'Choose Trail and set it to Don\'t allow optimization.',
    'Also go to Settings → Battery → App launch → Trail, choose Manage manually and turn everything on.',
  ],
  oneplus: [
    'Choose Trail and set it to Don\'t optimize.',
    'Also open Trail\'s app info → Battery and allow background activity.',
  ],
  oppo: [
    'Choose Trail and set it to Don\'t optimize.',
    'Also open Trail\'s app info → Battery and allow background activity.',
  ],
  vivo: [
    'Choose Trail and set it to Don\'t optimize.',
    'Also go to Settings → Battery → Background power consumption and allow Trail.',
  ],
  other: ['Choose All apps, find Trail and set it to Don\'t optimize.'],
};

const MORE_HELP: Record<PhoneBrand, string> = {
  xiaomi: 'https://dontkillmyapp.com/xiaomi',
  samsung: 'https://dontkillmyapp.com/samsung',
  huawei: 'https://dontkillmyapp.com/huawei',
  oneplus: 'https://dontkillmyapp.com/oneplus',
  oppo: 'https://dontkillmyapp.com/oppo',
  vivo: 'https://dontkillmyapp.com/vivo',
  other: 'https://dontkillmyapp.com',
};

export function batteryTips(brand: PhoneBrand): { steps: string[]; moreHelpUrl: string } {
  return { steps: TIPS[brand], moreHelpUrl: MORE_HELP[brand] };
}
