import {
  feedPosts,
  type FeedPost,
  hasProcessingPhotos,
  withLike,
  withOneMoreComment,
} from '../feed-cache';

const post = (id: string, likeCount = 3, likedByMe = false): FeedPost =>
  ({ id, likeCount, likedByMe, commentCount: 1 }) as FeedPost;

const feed = (...pages: FeedPost[][]) => ({
  pages: pages.map((items, i) => ({ items, nextCursor: i < pages.length - 1 ? `c${i}` : null })),
  pageParams: pages.map((_, i) => (i === 0 ? null : `c${i - 1}`)),
});

describe('withLike', () => {
  it('turns the heart on and counts one more, before the server answers', () => {
    const after = withLike(feed([post('a'), post('b')]), 'b', true);
    expect(feedPosts(after)).toEqual([post('a'), post('b', 4, true)]);
  });

  it('counts one less when unliking', () => {
    const after = withLike(feed([post('a', 4, true)]), 'a', false);
    expect(feedPosts(after)[0]).toMatchObject({ likedByMe: false, likeCount: 3 });
  });

  it("doesn't count twice when it's already liked", () => {
    const after = withLike(feed([post('a', 4, true)]), 'a', true);
    expect(feedPosts(after)[0].likeCount).toBe(4);
  });

  it("takes the server's count once it answers", () => {
    const after = withLike(feed([post('a')]), 'a', true, 10);
    expect(feedPosts(after)[0]).toMatchObject({ likedByMe: true, likeCount: 10 });
  });

  it('finds the post on a later page and leaves other pages as they were', () => {
    const before = feed([post('a')], [post('b')]);
    const after = withLike(before, 'b', true);
    expect(after.pages[0]).toBe(before.pages[0]);
    expect(after.pages[1].items[0].likedByMe).toBe(true);
  });
});

describe('withOneMoreComment', () => {
  it('adds one to the post’s comment count', () => {
    expect(feedPosts(withOneMoreComment(feed([post('a')]), 'a'))[0].commentCount).toBe(2);
  });
});

describe('feedPosts', () => {
  it('lists the posts of every page in order', () => {
    expect(feedPosts(feed([post('a'), post('b')], [post('c')])).map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('shows a post once when new posts pushed it onto the next page too', () => {
    expect(
      feedPosts(feed([post('a'), post('b')], [post('b'), post('c')])).map((p) => p.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('is empty before the first page arrives', () => {
    expect(feedPosts(undefined)).toEqual([]);
  });
});

describe('hasProcessingPhotos', () => {
  let n = 0;
  const withPhotos = (...statuses: ('pending' | 'ready' | 'failed')[]) =>
    ({ ...post(`p${n++}`), photos: statuses.map((status) => ({ status })) }) as FeedPost;

  it('is true while any photo is still being resized', () => {
    expect(hasProcessingPhotos(feed([withPhotos('ready')], [withPhotos('ready', 'pending')]))).toBe(
      true,
    );
  });

  it('is false once every photo is ready or failed, or with none', () => {
    expect(hasProcessingPhotos(feed([withPhotos('ready', 'failed'), withPhotos()]))).toBe(false);
    expect(hasProcessingPhotos(undefined)).toBe(false);
  });
});
