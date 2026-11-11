import type { BadgeNews } from '../badge-news';
import { useBadgeNewsStore } from '../badge-news-store';

const news = (id: string): BadgeNews => ({
  notificationId: id,
  code: `code-${id}`,
  title: `Badge unlocked: ${id}`,
  body: '',
});
const store = () => useBadgeNewsStore.getState();

beforeEach(() => store().reset());

it('announces unlocks one at a time: banner, then pop-up, then the next banner', () => {
  store().add([news('a'), news('b')]);
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['a', 'b']);

  store().openBanner(); // tapped the banner for a
  expect(store().open?.notificationId).toBe('a');
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['b']);

  store().close(); // b's banner is next
  expect(store().open).toBeNull();
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['b']);
});

it('moves on when a banner times out without a tap', () => {
  store().add([news('a'), news('b')]);
  store().dismissBanner();
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['b']);
});

it('never queues the same unlock twice, even after it was shown', () => {
  store().add([news('a')]);
  store().dismissBanner();
  // The next check finds it again (marking it read hadn't reached the server).
  store().add([news('a'), news('b')]);
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['b']);
});

it('opens a tapped push straight away, and drops its banner', () => {
  store().add([news('a'), news('b')]);
  store().openFromPush(news('b'));
  expect(store().open?.notificationId).toBe('b');
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['a']);
  store().add([news('b')]);
  expect(store().waiting.map((n) => n.notificationId)).toEqual(['a']);
});

it('forgets everything on sign out', () => {
  store().add([news('a')]);
  store().openBanner();
  store().reset();
  expect(store()).toMatchObject({ waiting: [], open: null, seen: {} });
  store().add([news('a')]); // the same phone, someone else's account later
  expect(store().waiting).toHaveLength(1);
});
