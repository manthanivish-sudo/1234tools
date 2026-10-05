'use strict';
/**
 * The channels a calendar slot can go to: each one's target format, limits,
 * links, hashtags, which kit or Reel Maker file to upload, a posting
 * checklist, red lines, and the rules a recorded post link must follow.
 *
 * EVERY NUMBER HERE COMES FROM THE PLATFORM'S OWN HELP, BUSINESS OR DEVELOPER
 * PAGES, read on the date in CHECKED, with the page in `src`. Where no
 * official page states a figure, or the page could not be read (several
 * Instagram, Facebook, TikTok and WhatsApp help pages only render with
 * JavaScript), the value is null and the guide says "not confirmed — check in
 * the app". Figures from a platform's publishing API or ads guide are labelled
 * so: they can differ from what the app allows.
 *
 * To refresh: open each `src`, compare, change `value` and set CHECKED (or a
 * spec's own `checked`) to the day you read it. The Guide tab, the CLI
 * (`desk.js guide <id>`) and the link checks all read this file;
 * `node build/promo/test.js` checks every link rule against `samples`.
 *
 *   list()                 every channel
 *   get(id)                one channel or null
 *   classify(url)          { platform, kind, https } from the link's shape alone
 *   check(channelId, url)  { ok, platform, kind, issues: [{ code, level: 'bad'|'warn', msg }] }
 *   cards()                the channels as Guide cards (with the desk's cadence for each venue)
 *
 * The desk never opens a recorded link: these checks read the text of the URL only.
 */

const CHECKED = '2026-10-04';
const NC = 'not confirmed — check in the app';

/* Sources, so each URL is written once. */
const SRC = {
  igMedia: 'https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media',
  igOembed: 'https://developers.facebook.com/docs/instagram-platform/oembed',
  igReelsAbout: 'https://about.instagram.com/features/reels',
  igCreatorsFaq: 'https://creators.instagram.com/faq?locale=en_US',
  igCarouselHelp: 'https://help.instagram.com/269314186824048/',
  igLinkInBio: 'https://help.instagram.com/362497417173378',
  igStoriesAbout: 'https://about.instagram.com/features/stories',
  igStoryHelp: 'https://help.instagram.com/1257341144298972',
  igLinkSticker: 'https://about.instagram.com/blog/announcements/expanding-sharing-links-in-stories-to-everyone',
  metaAspect: 'https://www.facebook.com/business/help/103816146375741',
  fbReelsHelp: 'https://www.facebook.com/business/help/2683452421955589',
  fbReelsApi: 'https://developers.facebook.com/docs/video-api/guides/reels-publishing',
  fbPhotosApi: 'https://developers.facebook.com/docs/graph-api/reference/page/photos/',
  fbFeedAds: 'https://www.facebook.com/business/ads-guide/update/image/facebook-feed',
  fbEmbed: 'https://developers.facebook.com/docs/plugins/embedded-posts/',
  threadsLaunch: 'https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/',
  threadsApi: 'https://developers.facebook.com/docs/threads/posts',
  threadsAttach: 'https://about.fb.com/news/2025/09/attach-text-threads-posts-share-longer-perspectives/',
  threadsTopics: 'https://help.instagram.com/1356090605000312',
  waStatusBlog: 'https://blog.whatsapp.com/new-ways-to-enjoy-whatsapp-status',
  waChannelsBlog: 'https://blog.whatsapp.com/introducing-whatsapp-channels-a-private-way-to-follow-what-matters',
  waChannels: 'https://www.whatsapp.com/channels',
  ytShorts: 'https://support.google.com/youtube/answer/12779649?hl=en',
  ytShorts3min: 'https://support.google.com/youtube/answer/15424877?hl=en',
  ytShortsUpload: 'https://support.google.com/youtube/answer/10059070?hl=en',
  ytEncoding: 'https://support.google.com/youtube/answer/1722171?hl=en',
  ytLimits: 'https://support.google.com/youtube/answer/57404?hl=en&co=GENIE.Platform%3DDesktop',
  ytLinks: 'https://support.google.com/youtube/answer/13748639?hl=en',
  ytRelated: 'https://support.google.com/youtube/answer/14075157?hl=en',
  ytHashtags: 'https://support.google.com/youtube/answer/6390658',
  ttMedia: 'https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide',
  ttDirect: 'https://developers.tiktok.com/doc/content-posting-api-reference-direct-post',
  ttEmbed: 'https://developers.tiktok.com/docs/en/embed-videos',
  pinSpecs: 'https://help.pinterest.com/en/article/review-pin-specs',
  pinProduct: 'https://help.pinterest.com/en/business/article/pinterest-product-specs',
  pinBuild: 'https://help.pinterest.com/en-gb/business/article/build-a-pin',
  pinBroken: 'https://help.pinterest.com/en/article/fix-a-broken-link',
  liPostLimit: 'https://www.linkedin.com/help/linkedin/answer/a528176',
  liMedia: 'https://www.linkedin.com/help/linkedin/answer/a564109',
  liVideo: 'https://www.linkedin.com/help/linkedin/answer/a548372',
  liPageVideo: 'https://www.linkedin.com/help/linkedin/answer/a1311816',
  liLink: 'https://www.linkedin.com/help/linkedin/answer/a525301',
  liUrl: 'https://www.linkedin.com/help/linkedin/answer/a1340792/finding-the-url-for-shared-content?lang=en',
  liPostsApi: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api',
  liDocument: 'https://www.linkedin.com/help/linkedin/answer/a518909',
  fbLinkTest: 'https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages',
  fbLinkSme: 'https://www.socialmediaexaminer.com/what-facebooks-new-link-rules-mean-for-your-2026-strategy/',
  fbLinkHelp: 'https://www.facebook.com/help/1929252614431792',
  metaOne: 'https://about.fb.com/news/2026/09/introducing-meta-one-subscription-service-more-features-ai/',
  metaOneBiz: 'https://www.facebook.com/business/news/introducing-meta-one-plans-for-businesses',
  xCount: 'https://docs.x.com/resources/fundamentals/counting-characters',
  xLink: 'https://help.x.com/en/using-x/how-to-post-a-link',
  xPremium: 'https://help.x.com/en/using-x/x-premium',
  xMedia: 'https://docs.x.com/x-api/media/quickstart/best-practices',
  xPictures: 'https://help.x.com/en/using-x/posting-gifs-and-pictures',
  xVideos: 'https://help.x.com/en/using-x/x-videos',
  xHashtags: 'https://help.x.com/en/using-x/how-to-use-hashtags',
  xEmbed: 'https://docs.x.com/x-for-websites/embedded-posts/overview',
  bskyPost: 'https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json',
  bskyImages: 'https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/images.json',
  bskyVideo: 'https://bsky.social/about/blog/09-11-2024-video',
  bskyPostsDoc: 'https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/posts.md',
  bskySearch: 'https://bsky.social/about/blog/05-31-2024-search',
  bskyOembed: 'https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/oembed.md',
  mastoPosting: 'https://docs.joinmastodon.org/user/posting/',
  mastoStatus: 'https://docs.joinmastodon.org/entities/Status/',
  tgBotApi: 'https://core.telegram.org/bots/api',
  tgFaq: 'https://telegram.org/faq',
  tgChannels: 'https://telegram.org/tour/channels',
  tgLinks: 'https://core.telegram.org/api/links'
};

/** One spec row: a value from an official page, or null for "not confirmed". */
function s(label, value, src, checked) { return { label, value: value == null ? null : value, src: value == null ? (src || '') : src, checked: checked || CHECKED }; }

/* The files the desk and the Reel Maker make (kit.js; engine/aivid-reel-maker.js). */
const FILE = {
  reel: 'reel-<tool>.mp4 from the Reel Maker: 1080×1920 (9:16), H.264 MP4, up to 90 seconds (the Reel Maker\'s own limit)',
  cover: 'reel-<tool>-cover.png (or .jpg), the cover the Reel Maker exports beside the video',
  carousel: 'carousel-1.png … carousel-5.png from the kit: five slides, 1080×1350 (4:5)',
  pdf: 'carousel.pdf from the kit: the same five slides as 1080×1350 pages',
  square: 'square-1080.png from the kit: 1080×1080',
  story: 'story-1080x1920.png from the kit: 1080×1920 with a QR code to the tool',
  pin: 'pin-1000x1500.png from the kit: 1000×1500 (2:3)',
  wide: 'wide-1200x630.png from the kit: 1200×630, the link-preview shape'
};

/* Red lines per kind of channel: the README's rules, in words that pass lint.js. */
const RL = {
  common: ['A human publishes every post: no scheduled, automated or bulk posting.', 'One link per post; disclose that you built the site wherever that is not obvious.', 'AI at work slots: wherever the word free appears, say free for 10 runs a month and that text goes to a model.'],
  video: ['No hashtag stuffing, bot comments or link-drop comments on other people\'s videos.'],
  youtube: ['No links in YouTube comments: name the site in words.'],
  social: ['No repeated identical text, no follow and unfollow churn, and never ride a trending tag the post has nothing to do with.'],
  linkedin: ['No automation tools, connection blasts or engagement pods.'],
  facebook: ['In groups, links only on the group\'s allowed day, and never one link to many groups in a day.'],
  chat: ['Broadcast only to people who chose to follow; no unsolicited direct messages.']
};

const CHANNELS = [
  {
    id: 'instagram-reel', name: 'Instagram Reel', short: 'IG Reel', platform: 'instagram', venue: 'social-instagram', template: 'instagram-caption', linkShape: true,
    summary: 'Vertical video in the Reels tab and feed; the link lives in your profile, not the caption.',
    specs: [
      s('Aspect ratio', '9:16 recommended (publishing API)', SRC.igMedia),
      s('Pixel size', null, 'https://help.instagram.com/1038071743007909'),
      s('Maximum length (app)', 'Clips that add up to 20 minutes', SRC.igReelsAbout),
      s('Maximum length (API)', '15 minutes; 3 seconds minimum', SRC.igMedia),
      s('Recommended length', '3 minutes or less: longer Reels are not recommended to people who do not follow you', SRC.igReelsAbout),
      s('File type', 'MP4 or MOV, H.264 or HEVC (publishing API)', SRC.igMedia),
      s('Maximum file size', '300 MB (publishing API)', SRC.igMedia),
      s('Caption limit', '2,200 characters, 30 hashtags, 20 @ mentions (publishing API)', SRC.igMedia),
      s('Links in the caption', null, 'https://help.instagram.com/236245819849257'),
      s('Link in bio', 'Up to 5 websites on your profile', SRC.igLinkInBio),
      s('Hashtags', 'Trending hashtags that are relevant to the reel can help it reach more people. A lower in-app cap has been reported but no official page confirms it', SRC.igCreatorsFaq),
      s('First seconds', 'Instagram advises making the first 3 seconds engaging', SRC.igCreatorsFaq),
      s('Post link', 'instagram.com/reel/{shortcode}/', SRC.igOembed)
    ],
    upload: [FILE.reel, FILE.cover],
    steps: [
      'Export the Reel from the Reel Maker at 1080×1920; it stays well inside every Reel limit above.',
      'In Instagram: + then Reel, pick reel-<tool>.mp4, and set the cover from reel-<tool>-cover.png.',
      'Paste the caption from Draft (template instagram-caption). Lint must be clean; the hook goes in the first line.',
      'The tool\'s address must be readable in the video itself (the call-to-action beat) because the link lives in your profile: check the bio link points to the site.',
      'Share. Open the Reel, Share, Copy link, and paste it into the calendar row. It must read instagram.com/reel/…'
    ],
    redLines: RL.video.concat(RL.social, RL.common),
    url: { accept: ['ig-reel'], near: { 'ig-feed': 'wrong format: this is a feed post (instagram.com/p/…), the slot asked for a Reel (instagram.com/reel/…)', 'ig-story': 'wrong format: this is a Story, the slot asked for a Reel', 'ig-profile': 'wrong format: this is a profile link, not a post' } },
    linkExample: 'https://www.instagram.com/reel/C1a2B3c4D5e/',
    samples: { valid: ['https://www.instagram.com/reel/C1a2B3c4D5e/', 'https://instagram.com/reels/C1a2B3c4D5e', 'https://www.instagram.com/your.handle/reel/C1a2B3c4D5e/?igsh=abc'], wrongFormat: ['https://www.instagram.com/p/C1a2B3c4D5e/'], wrongPlatform: ['https://www.tiktok.com/@you/video/7301234567890123456'] }
  },
  {
    id: 'instagram-carousel', name: 'Instagram feed carousel', short: 'IG feed', platform: 'instagram', venue: 'social-instagram', template: 'instagram-caption', linkShape: true,
    summary: 'The kit\'s five 4:5 slides as one swipeable feed post.',
    specs: [
      s('Items per post (app)', 'Up to 20 photos and videos', SRC.igCarouselHelp),
      s('Items per post (API)', 'Up to 10', SRC.igMedia),
      s('Aspect ratio (API)', 'Between 4:5 and 1.91:1', SRC.igMedia),
      s('Aspect ratio (Meta advice)', '1:1 or 4:5 recommended for carousel images', SRC.metaAspect),
      s('Image width (API)', '320 to 1440 pixels', SRC.igMedia),
      s('File type (API)', 'JPEG, 8 MB maximum', SRC.igMedia),
      s('Caption limit', '2,200 characters, 30 hashtags, 20 @ mentions (publishing API)', SRC.igMedia),
      s('Links in the caption', null, 'https://help.instagram.com/236245819849257'),
      s('Link in bio', 'Up to 5 websites on your profile', SRC.igLinkInBio),
      s('Post link', 'instagram.com/p/{shortcode}/', SRC.igOembed)
    ],
    upload: [FILE.carousel, FILE.square + ' (for a single-image post instead)'],
    steps: [
      'Make the kit; the five carousel PNGs are 1080×1350, the 4:5 shape. If the app refuses a PNG, save the slides as JPEG.',
      'In Instagram: + then Post, select carousel-1.png to carousel-5.png in order. Keep the 4:5 crop for every slide.',
      'Paste the caption from Draft (template instagram-caption) and read the lint.',
      'Share. Open the post, Share, Copy link, and record it. It must read instagram.com/p/…'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['ig-feed'], near: { 'ig-reel': 'wrong format: this is a Reel (instagram.com/reel/…), the slot asked for a feed carousel (instagram.com/p/…)', 'ig-story': 'wrong format: this is a Story, the slot asked for a feed carousel', 'ig-profile': 'wrong format: this is a profile link, not a post' } },
    linkExample: 'https://www.instagram.com/p/C1a2B3c4D5e/',
    samples: { valid: ['https://www.instagram.com/p/C1a2B3c4D5e/', 'https://www.instagram.com/p/fA9uwTtkSN/?img_index=1'], wrongFormat: ['https://www.instagram.com/reel/C1a2B3c4D5e/'], wrongPlatform: ['https://www.facebook.com/20531316728/posts/10154009990506729/'] }
  },
  {
    id: 'instagram-story', name: 'Instagram Story', short: 'IG Story', platform: 'instagram', venue: 'social-instagram', template: 'instagram-caption', linkShape: true, tick: true,
    summary: 'Full-screen, gone after 24 hours; the one Instagram place a link sticker works.',
    specs: [
      s('Aspect ratio', '9:16 recommended', SRC.metaAspect),
      s('Video length', 'Up to 60 seconds shows as one clip; longer videos are split into clips', SRC.igStoriesAbout),
      s('Maximum file size (API)', 'Images 8 MB (JPEG), video 100 MB', SRC.igMedia),
      s('Lifetime', 'Disappears after 24 hours', SRC.igStoryHelp),
      s('Links', 'Link sticker, open to all accounts except new ones and accounts that repeatedly share harmful content', SRC.igLinkSticker),
      s('Story link', null, 'https://help.instagram.com/1257341144298972')
    ],
    upload: [FILE.story, FILE.reel + ' (as a video story)'],
    steps: [
      'Use story-1080x1920.png: its QR code already leads to the tool.',
      'In Instagram: + then Story, pick the image. Add the Link sticker with the tool\'s link from kit.md (the instagram-story UTM link).',
      'Keep text and the sticker clear of the top and bottom edges, where the app draws its own controls.',
      'Share. A story has no lasting link, so press Posted (tick) on the calendar row, or paste its link if you copied one.'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['ig-story'], near: { 'ig-reel': 'wrong format: this is a Reel, the slot asked for a Story', 'ig-feed': 'wrong format: this is a feed post, the slot asked for a Story', 'ig-profile': 'wrong format: this is a profile link, not a story' } },
    linkExample: '',
    samples: { valid: ['https://www.instagram.com/stories/your.handle/3301234567890123456/'], wrongFormat: ['https://www.instagram.com/p/C1a2B3c4D5e/'], wrongPlatform: ['https://www.threads.net/@you/post/C1a2B3c4D5e'] }
  },
  {
    id: 'facebook-reel', name: 'Facebook Reel', short: 'FB Reel', platform: 'facebook', venue: 'social-facebook', template: 'instagram-caption', linkShape: true,
    summary: 'The same vertical video on your Facebook Page, posted natively with no link: it does not touch the Page\'s link-post budget.',
    specs: [
      s('Length', 'Any length or orientation: since June 2025 every video posted to Facebook is shared as a reel', SRC.fbReelsHelp),
      s('Length (API)', '3 to 90 seconds through the Reels publishing API', SRC.fbReelsApi),
      s('Aspect ratio (API)', '9:16', SRC.fbReelsApi),
      s('Pixel size (API)', '1080×1920 recommended; 540×960 minimum', SRC.fbReelsApi),
      s('File type (API)', 'MP4 recommended; 24 to 60 frames per second', SRC.fbReelsApi),
      s('Maximum file size', null, SRC.fbReelsApi),
      s('Caption limit', null, ''),
      s('Hashtags', null, ''),
      s('Post link', null, '')
    ],
    upload: [FILE.reel, FILE.cover],
    steps: [
      'Post from the Page, not your personal profile.',
      'Create, Reel, pick reel-<tool>.mp4. It is 1080×1920 and inside the publishing API\'s 90 seconds.',
      'Paste the caption from Draft and take the link out: say "search 1234Tools" (or the site\'s name) or "link on our Page" instead. A native post without a link does not use the link budget; Meta reports put clickable Reel links behind its paid plans.',
      'Keep the address readable in the video itself (the call-to-action beat).',
      'Publish. Open the reel, Share, Copy link, and record it. Expect facebook.com/reel/…; a fb.watch short link is accepted with a note.'
    ],
    redLines: RL.video.concat(RL.facebook, RL.common),
    url: { accept: ['fb-reel'], soft: { 'fb-short': 'short link: the desk cannot see whether fb.watch leads to a reel or another video' }, near: { 'fb-post': 'wrong format: this is a Page post, the slot asked for a Reel (facebook.com/reel/…)', 'fb-video': 'wrong format: this is a video link, the slot asked for a Reel (facebook.com/reel/…). If Facebook only offers this link, press It is right', 'fb-group-post': 'wrong format: this is a group post, the slot asked for a Reel on your Page', 'fb-other': 'wrong format: this is a page or profile link, not a post' } },
    linkExample: 'https://www.facebook.com/reel/1234567890123456',
    samples: { valid: ['https://www.facebook.com/reel/1234567890123456', 'https://www.facebook.com/share/r/1AbCdEfGh/'], wrongFormat: ['https://www.facebook.com/20531316728/posts/10154009990506729/'], wrongPlatform: ['https://www.instagram.com/reel/C1a2B3c4D5e/'] }
  },
  {
    id: 'facebook-post', name: 'Facebook Page post', short: 'FB post', platform: 'facebook', venue: 'social-facebook', template: 'threads-post', linkShape: true,
    summary: 'A Page post. Native (image or carousel, no link) by default; a link post spends the monthly link budget.',
    specs: [
      s('Link posts (reported test)', 'Meta has been testing a limit of 2 link posts a month for Pages and professional-mode profiles without a paid plan; Meta confirmed a "limited test" (December 2025); the number comes from reports, not from Meta', SRC.fbLinkTest, '2026-10-05'),
      s('Paid plans (official)', 'Meta One (15 September 2026): the Advanced plan, from $49.99 a month, includes links in organic posts and Reels; plans, prices and availability vary by region', SRC.metaOne, '2026-10-05'),
      s('Over the limit (reported)', null, SRC.fbLinkHelp, '2026-10-05'),
      s('Links in comments (reported)', null, SRC.fbLinkHelp, '2026-10-05'),
      s('Photo file type (API)', 'JPEG, BMP, PNG, GIF or TIFF', SRC.fbPhotosApi),
      s('Photo file size (API)', '10 MB maximum; PNG over 1 MB may look pixelated', SRC.fbPhotosApi),
      s('Aspect ratio (ads guide)', '4:5, 1440×1800 pixels, for feed images', SRC.fbFeedAds),
      s('Text limit', null, ''),
      s('Hashtags', null, ''),
      s('Post link', 'facebook.com/{page-id}/posts/{post-id}', SRC.fbEmbed)
    ],
    upload: [FILE.square, FILE.carousel + ' (as a multi-photo post)', FILE.wide + ' (the preview shape when the post is a link)'],
    steps: [
      'Post as the Page. By default post natively: the result image (square-1080.png) or the carousel slides, with "search 1234Tools" or "link on our Page" in the text and no link. That costs nothing from the link budget.',
      'Spend a link post (the desk shows "x of 2 used this month") only on the tools that bring the most visits: check GA4 first.',
      'If the link budget is used up, the post still goes out but reports say the link can show as plain text. A link in the first comment is a fallback only: reports disagree on whether it counts too.',
      'A Story with a link sticker, and groups by their own rules, are other ways to share a link.',
      'Write the text in Draft (template threads-post works as a short Page post).',
      'Publish. Open the post (its time stamp), copy the address, and record it. Tick "no link" when you record a native post, so the budget stays right.'
    ],
    redLines: RL.facebook.concat(RL.social, RL.common),
    url: { accept: ['fb-post'], soft: { 'fb-short': 'short link: the desk cannot see what fb.watch leads to' }, near: { 'fb-reel': 'wrong format: this is a Reel, the slot asked for a Page post', 'fb-video': 'wrong format: this is a video link, the slot asked for a Page post', 'fb-group-post': 'wrong format: this is a group post, the slot asked for a post on your Page', 'fb-other': 'wrong format: this is a page or profile link, not a post' } },
    linkExample: 'https://www.facebook.com/20531316728/posts/10154009990506729/',
    samples: { valid: ['https://www.facebook.com/20531316728/posts/10154009990506729/', 'https://www.facebook.com/permalink.php?story_fbid=123456789&id=987654321', 'https://www.facebook.com/share/p/1AbCdEfGh/'], wrongFormat: ['https://www.facebook.com/reel/1234567890123456'], wrongPlatform: ['https://www.linkedin.com/feed/update/urn:li:activity:7101234567890123456/'] }
  },
  {
    id: 'youtube-shorts', name: 'YouTube Shorts', short: 'Shorts', platform: 'youtube', venue: 'video-youtube-channel', template: 'youtube-description', linkShape: true,
    summary: 'Square or vertical video up to 3 minutes; description links are not clickable on Shorts.',
    specs: [
      s('Aspect ratio', 'Square or vertical', SRC.ytShorts),
      s('Resolution', 'Up to 1080p', SRC.ytShortsUpload),
      s('Maximum length', 'Up to 3 minutes', SRC.ytShorts),
      s('Music and claims', 'A Short over 1 minute with an active Content ID claim is blocked worldwide', SRC.ytShorts3min),
      s('File type', 'MP4 (YouTube\'s recommended upload container)', SRC.ytEncoding),
      s('Maximum file size', null, ''),
      s('Title / description', '100 / 5,000 characters', SRC.ytLimits),
      s('Links', 'Links in Shorts descriptions and comments are not clickable; a Related video link is, and the channel page can show up to 14 links', SRC.ytLinks),
      s('Related video', 'A clickable link under your handle to one of your public or unlisted videos (needs advanced features)', SRC.ytRelated),
      s('Hashtags', 'In the title or description; a video with more than 60 hashtags has all of them ignored', SRC.ytHashtags),
      s('Post link', null, '')
    ],
    upload: [FILE.reel, FILE.cover + ' (a Short\'s thumbnail is picked from the video in the app)'],
    steps: [
      'Upload reel-<tool>.mp4 as a Short (vertical, 1080×1920, well under 3 minutes).',
      'Title within 100 characters; paste the description from Draft (template youtube-description). Its link is not clickable on Shorts, so the video must name the address too.',
      'If your channel has advanced features, set a Related video that walks through the tool.',
      'Publish. Open the Short, Share, Copy link, and record it. It must read youtube.com/shorts/…'
    ],
    redLines: RL.youtube.concat(RL.video, RL.common),
    url: { accept: ['yt-short'], near: { 'yt-watch': 'wrong format: this is a watch link (watch?v= or youtu.be), the slot asked for a Short (youtube.com/shorts/…). Copy the link from the Short itself; if YouTube will only give this one, press It is right', 'yt-channel': 'wrong format: this is a channel link, not a Short' } },
    linkExample: 'https://youtube.com/shorts/aBcDeFgHiJk',
    samples: { valid: ['https://youtube.com/shorts/aBcDeFgHiJk', 'https://www.youtube.com/shorts/aBcDeFgHiJk?feature=share'], wrongFormat: ['https://www.youtube.com/watch?v=aBcDeFgHiJk', 'https://youtu.be/aBcDeFgHiJk'], wrongPlatform: ['https://www.tiktok.com/@you/video/7301234567890123456'] }
  },
  {
    id: 'tiktok', name: 'TikTok video', short: 'TikTok', platform: 'tiktok', venue: 'video-tiktok', template: 'tiktok-caption', linkShape: true,
    summary: 'Vertical video; the same MP4 as the Reel. TikTok\'s own help pages could not be read, so most figures come from its developer docs.',
    specs: [
      s('Aspect ratio', null, ''),
      s('Dimensions (developer docs)', '360 to 4,096 pixels on each side', SRC.ttMedia),
      s('Maximum length (developer docs)', 'Every creator can post 3-minute videos; some can post 5 or 10 minutes', SRC.ttMedia),
      s('File type (developer docs)', 'MP4 (recommended), WebM or MOV; H.264 recommended; 23 to 60 frames per second', SRC.ttMedia),
      s('Maximum file size (developer docs)', '4 GB', SRC.ttMedia),
      s('Caption limit (developer docs)', '2,200 characters (UTF-16)', SRC.ttDirect),
      s('Links', null, ''),
      s('Hashtags', null, ''),
      s('Post link', 'tiktok.com/@{user}/video/{id}', SRC.ttEmbed)
    ],
    upload: [FILE.reel],
    steps: [
      'Upload reel-<tool>.mp4 (1080×1920, inside the 3-minute limit every account has).',
      'Paste the caption from Draft (template tiktok-caption). Name the site in words; the link goes in your profile if your account has one.',
      'Post. Share, Copy link, and record it. Expect tiktok.com/@you/video/…; a vm.tiktok.com short link is accepted with a note.'
    ],
    redLines: RL.video.concat(RL.social, RL.common),
    url: { accept: ['tt-video'], soft: { 'tt-short': 'short link: the desk cannot see whether it leads to a video or a photo post' }, near: { 'tt-photo': 'wrong format: this is a photo post, the slot asked for a video', 'tt-profile': 'wrong format: this is a profile link, not a video' } },
    linkExample: 'https://www.tiktok.com/@you/video/7301234567890123456',
    samples: { valid: ['https://www.tiktok.com/@you/video/7301234567890123456', 'https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=en'], wrongFormat: ['https://www.tiktok.com/@you/photo/7301234567890123456'], wrongPlatform: ['https://youtube.com/shorts/aBcDeFgHiJk'] }
  },
  {
    id: 'pinterest-video', name: 'Pinterest video pin', short: 'Pin video', platform: 'pinterest', venue: 'social-pinterest', template: 'pinterest-pin', linkShape: true,
    summary: 'A short video pin that links straight to the tool and keeps being found in search.',
    specs: [
      s('Aspect ratio / size', '9:16 or 1080×1920 for full-bleed; 1:2, 2:3, 3:4, 4:5 and 1:1 also work', SRC.pinSpecs),
      s('Length', '4 seconds to 5 minutes', SRC.pinSpecs),
      s('Length (ads specs)', '4 seconds to 15 minutes; 6 to 15 seconds recommended for ads', SRC.pinProduct),
      s('File type', 'MP4 or M4V on the web; MP4, MOV or M4V in the app; H.264 or H.265', SRC.pinSpecs),
      s('Maximum file size (ads specs)', 'Up to 2 GB', SRC.pinProduct),
      s('Title / description', '100 characters / up to 800 characters', SRC.pinSpecs),
      s('Text overlay box', '250 characters', SRC.pinSpecs),
      s('Safe zones', 'Keep text clear of the top 270 px, left 65 px, right 195 px and bottom 790 px', SRC.pinSpecs),
      s('Destination link', 'Add the link in the Pin\'s link field; link straight to the page, because links that redirect are blocked', SRC.pinBroken),
      s('Hashtags', 'Allowed in the description', SRC.pinBuild),
      s('Post link', null, '')
    ],
    upload: [FILE.reel],
    steps: [
      'Create Pin, upload reel-<tool>.mp4 (1080×1920 is the full-bleed size).',
      'Title as a search phrase (100 characters), description from Draft (template pinterest-pin).',
      'Put the tool\'s link in the link field. Use the link from kit.md as it is: no redirects or shorteners.',
      'Publish. Open the pin, Share, Copy link, and record it. Expect pinterest.com/pin/… or a pin.it short link.'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['pin'], soft: { 'pin-short': 'short link: the desk cannot see which pin pin.it leads to' }, warnAlways: 'The link looks the same for a video and an image pin: the desk cannot see which you posted.', near: { 'pin-other': 'wrong format: this is a board or profile link, not a pin' } },
    linkExample: 'https://www.pinterest.com/pin/123456789012345678/',
    samples: { valid: ['https://www.pinterest.com/pin/123456789012345678/', 'https://uk.pinterest.com/pin/123456789012345678/', 'https://in.pinterest.com/pin/123456789012345678/', 'https://pin.it/1AbCdEfGh'], wrongFormat: ['https://www.pinterest.com/yourname/tools-board/'], wrongPlatform: ['https://www.instagram.com/p/C1a2B3c4D5e/'] }
  },
  {
    id: 'pinterest-image', name: 'Pinterest image pin', short: 'Pin image', platform: 'pinterest', venue: 'social-pinterest', template: 'pinterest-pin', linkShape: true,
    summary: 'The kit\'s 2:3 pin, linked straight to the tool.',
    specs: [
      s('Aspect ratio / size', '2:3, or 1000×1500 pixels (Pinterest\'s product specs)', SRC.pinProduct),
      s('File type', 'BMP, JPEG, PNG, TIFF or WEBP', SRC.pinSpecs),
      s('Maximum file size', '20 MB on the web', SRC.pinSpecs),
      s('Title / description', '100 characters / up to 800 characters', SRC.pinSpecs),
      s('Destination link', 'Add the link in the Pin\'s link field; link straight to the page, because links that redirect are blocked', SRC.pinBroken),
      s('Hashtags', 'Allowed in the description', SRC.pinBuild),
      s('Post link', null, '')
    ],
    upload: [FILE.pin],
    steps: [
      'Create Pin, upload pin-1000x1500.png (exactly 2:3).',
      'Title as a search phrase, description from Draft (template pinterest-pin); the alt text is in kit.md too.',
      'Put the tool\'s link in the link field, straight from kit.md.',
      'Publish, Copy link, record it. Expect pinterest.com/pin/… or pin.it/…'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['pin'], soft: { 'pin-short': 'short link: the desk cannot see which pin pin.it leads to' }, warnAlways: 'The link looks the same for a video and an image pin: the desk cannot see which you posted.', near: { 'pin-other': 'wrong format: this is a board or profile link, not a pin' } },
    linkExample: 'https://www.pinterest.com/pin/123456789012345678/',
    samples: { valid: ['https://www.pinterest.co.uk/pin/123456789012345678/', 'https://pin.it/1AbCdEfGh'], wrongFormat: ['https://www.pinterest.com/yourname/'], wrongPlatform: ['https://bsky.app/profile/you.bsky.social/post/3k2abcdefgh2x'] }
  },
  {
    id: 'linkedin-post', name: 'LinkedIn post', short: 'LinkedIn', platform: 'linkedin', venue: 'social-linkedin', template: 'linkedin-post', linkShape: true,
    summary: 'A text post with the video or an image; the desk puts the link in the first comment.',
    specs: [
      s('Text limit', '3,000 characters', SRC.liPostLimit),
      s('Images', 'GIF, HEIF/HEIC, JPEG, PNG or WEBP; up to 100 MB and 36 megapixels', SRC.liMedia),
      s('Video (member post)', 'Up to 15 minutes and 5 GB; at least 3 seconds on desktop (2 in the app); aspect ratio 1:2.4 to 2.4:1', SRC.liVideo),
      s('Video (Page post)', 'Up to 10 minutes and 5 GB', SRC.liPageVideo),
      s('Video (other help page)', 'Another LinkedIn help page gives 100 MB for video: if an upload fails, keep the file under it', SRC.liMedia),
      s('Link preview', '1.91:1, 1200×627 pixels', SRC.liLink),
      s('Hashtags', null, ''),
      s('Post link', 'linkedin.com/feed/update/urn:li:…:{id}/ (Copy link to post)', SRC.liPostsApi)
    ],
    upload: [FILE.reel + ' (developer trick and AI at work slots)', FILE.square + ' (an image post instead)'],
    steps: [
      'Start a post, add reel-<tool>.mp4 (or the square image).',
      'Paste the text from Draft (template linkedin-post), within 3,000 characters.',
      'Post, then add the tool\'s link as the first comment, as the desk\'s LinkedIn rule says.',
      'Open the post menu, Copy link to post, and record it.'
    ],
    redLines: RL.linkedin.concat(RL.common),
    url: { accept: ['li-post'], soft: { 'li-short': 'short link: the desk cannot see which post lnkd.in leads to' }, near: { 'li-article': 'wrong format: this is an article (linkedin.com/pulse/…), the slot asked for a post', 'li-other': 'wrong format: this is a profile or page link, not a post' } },
    linkExample: 'https://www.linkedin.com/posts/yourname_merge-pdf-activity-7101234567890123456-AbCd',
    samples: { valid: ['https://www.linkedin.com/posts/yourname_merge-pdf-activity-7101234567890123456-AbCd', 'https://www.linkedin.com/feed/update/urn:li:activity:7101234567890123456/', 'https://www.linkedin.com/feed/update/urn:li:ugcPost:7101234567890123456/'], wrongFormat: ['https://www.linkedin.com/pulse/how-merge-pdfs-your-name/'], wrongPlatform: ['https://x.com/you/status/1712345678901234567'] }
  },
  {
    id: 'linkedin-document', name: 'LinkedIn document (carousel PDF)', short: 'LI document', platform: 'linkedin', venue: 'social-linkedin', template: 'linkedin-post', linkShape: true,
    summary: 'The kit\'s carousel.pdf as a swipeable document post.',
    specs: [
      s('File type', 'PDF, PPT, PPTX, DOC or DOCX', SRC.liDocument),
      s('Limits', '100 MB and 300 pages', SRC.liDocument),
      s('Title', 'Give the document a title; it also forms the post\'s link', SRC.liUrl),
      s('After posting', 'The document cannot be changed, and people who can see the post can download it as a PDF', SRC.liDocument),
      s('Text limit', '3,000 characters', SRC.liPostLimit),
      s('Page size', null, ''),
      s('Post link', 'linkedin.com/feed/update/urn:li:…:{id}/ (Copy link to post)', SRC.liPostsApi)
    ],
    upload: [FILE.pdf],
    steps: [
      'Start a post, choose Add a document, and upload carousel.pdf (5 pages).',
      'Give it a plain title (the tool\'s job, for example "Merge PDFs in three steps").',
      'Paste the text from Draft (template linkedin-post). Check the slides once more: a posted document cannot be changed.',
      'Post, add the link as the first comment, then Copy link to post and record it.'
    ],
    redLines: RL.linkedin.concat(RL.common),
    url: { accept: ['li-post'], soft: { 'li-short': 'short link: the desk cannot see which post lnkd.in leads to' }, warnAlways: 'A document post has the same kind of link as any post: the desk cannot see that the PDF is attached.', near: { 'li-article': 'wrong format: this is an article (linkedin.com/pulse/…), the slot asked for a document post', 'li-other': 'wrong format: this is a profile or page link, not a post' } },
    linkExample: 'https://www.linkedin.com/posts/yourname_merge-pdfs-in-three-steps-activity-7101234567890123456-AbCd',
    samples: { valid: ['https://www.linkedin.com/posts/yourname_merge-pdfs-in-three-steps-activity-7101234567890123456-AbCd', 'https://www.linkedin.com/feed/update/urn:li:share:7101234567890123456'], wrongFormat: ['https://www.linkedin.com/in/yourname/'], wrongPlatform: ['https://www.facebook.com/20531316728/posts/10154009990506729/'] }
  },
  {
    id: 'x', name: 'X post', short: 'X', platform: 'x', venue: 'social-x', template: 'x-post', linkShape: true,
    summary: '280 characters with the video attached; the desk puts the link in the first reply.',
    specs: [
      s('Text limit', '280 characters; every link counts as 23; attached media counts as 0', SRC.xCount),
      s('Longer posts', 'Up to 25,000 characters, for Premium subscribers only', SRC.xPremium),
      s('Media per post', 'Up to 4 photos, 1 animated GIF or 1 video', SRC.xMedia),
      s('Video (help centre)', 'Up to 140 seconds and 512 MB without Premium', SRC.xVideos),
      s('Video (developer docs)', 'Aspect ratio between 1:3 and 3:1; 720×1280 portrait recommended; H.264 with AAC sound', SRC.xMedia),
      s('Images', 'JPG, PNG, GIF or WEBP up to 5 MB; a single photo between 2:1 and 3:4 shows in full', SRC.xPictures),
      s('Links', 'Every link is shortened through t.co', SRC.xLink),
      s('Hashtags', 'X recommends no more than 2 hashtags a post', SRC.xHashtags),
      s('Post link', 'x.com/{user}/status/{id}', SRC.xEmbed)
    ],
    upload: [FILE.reel + ' (inside the 140 seconds X allows without Premium)', FILE.square + ' (an image post instead)'],
    steps: [
      'Paste the post from Draft (template x-post): it counts each link as 23 characters, as X does.',
      'Attach reel-<tool>.mp4 (or the square image). The link goes in the first reply, as the draft shows.',
      'At most two hashtags.',
      'Post, add the reply with the link, then Share, Copy link to post, and record the main post\'s link. It must read x.com/you/status/…'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['x-post'], near: { 'x-short': 'wrong format: this is a t.co link (the wrapped link inside a post), not the post\'s own link', 'x-profile': 'wrong format: this is a profile link, not a post' } },
    linkExample: 'https://x.com/you/status/1712345678901234567',
    samples: { valid: ['https://x.com/you/status/1712345678901234567', 'https://twitter.com/Interior/status/463440424141459456?s=20'], wrongFormat: ['https://x.com/you', 'https://t.co/AbCdEfGh12'], wrongPlatform: ['https://bsky.app/profile/you.bsky.social/post/3k2abcdefgh2x'] }
  },
  {
    id: 'bluesky', name: 'Bluesky post', short: 'Bluesky', platform: 'bluesky', venue: 'social-bluesky', template: 'bluesky-post', linkShape: true,
    summary: '300 characters; a link shows as a card. Videos were capped at 60 seconds when the feature launched.',
    specs: [
      s('Text limit', '300 graphemes (what people see as characters)', SRC.bskyPost),
      s('Images', 'Up to 4 images, up to 2 MB each', SRC.bskyImages),
      s('Video', 'One video a post, up to 60 seconds; MP4, MPEG, WebM or MOV (announced September 2024). A later Bluesky post hints at longer videos; no official page states a new limit', SRC.bskyVideo),
      s('Video file size', null, ''),
      s('Links', 'A link can show as a website card, the preview built from the page', SRC.bskyPostsDoc),
      s('Hashtags', 'Supported: a # term shows posts with that tag', SRC.bskySearch),
      s('Post link', 'bsky.app/profile/{handle}/post/{id}', SRC.bskyOembed)
    ],
    upload: [FILE.reel + ' (keep it within 60 seconds)', FILE.square + ' (an image post instead)'],
    steps: [
      'Paste the post from Draft (template bluesky-post, counted in graphemes like Bluesky does). The link is the clean URL, no UTM.',
      'Attach the square image, or the Reel if it is 60 seconds or shorter; or let the link card be the picture.',
      'Post, then the menu, Copy link to post, and record it. It must read bsky.app/profile/…/post/…'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['bsky-post'], near: { 'bsky-profile': 'wrong format: this is a profile link, not a post', 'bsky-other': 'wrong format: this Bluesky link is not a post' } },
    linkExample: 'https://bsky.app/profile/you.bsky.social/post/3k2abcdefgh2x',
    samples: { valid: ['https://bsky.app/profile/you.bsky.social/post/3k2abcdefgh2x', 'https://bsky.app/profile/did:plc:abcdefghijklmnop/post/3k2abcdefgh2x'], wrongFormat: ['https://bsky.app/profile/you.bsky.social'], wrongPlatform: ['https://mastodon.social/@you/112345678901234567'] }
  },
  {
    id: 'mastodon', name: 'Mastodon post', short: 'Mastodon', platform: 'mastodon', venue: 'social-mastodon', template: 'mastodon-post', linkShape: true,
    summary: '500 characters on most servers; hashtags are how people find posts.',
    specs: [
      s('Text limit', '500 characters by default (your server may differ); a link counts as 23', SRC.mastoPosting),
      s('Media per post', 'Up to 4 images, or one video', SRC.mastoPosting),
      s('Images', 'PNG, JPG, HEIF, WEBP or AVIF up to 16 MB', SRC.mastoPosting),
      s('Video', 'MP4, M4V, MOV or WebM up to 99 MB; converted to H.264 MP4', SRC.mastoPosting),
      s('Video length', null, ''),
      s('Links', 'A link gets a preview card; link shorteners are discouraged', SRC.mastoPosting),
      s('Hashtags', 'A #hashtag makes the post findable by anyone searching or following it', SRC.mastoPosting),
      s('Post link', 'https://{server}/@{user}/{id}', SRC.mastoStatus)
    ],
    upload: [FILE.reel + ' (under 99 MB)', FILE.square + ' (an image post instead)'],
    steps: [
      'Paste the post from Draft (template mastodon-post): one link, the clean tool address.',
      'Attach the Reel or the square image, and write a description (alt text) for it; kit.md has one.',
      'Add a few plain hashtags for the tool\'s subject: on Mastodon they are how people who do not follow you find the post.',
      'Post, open it, copy the address from the time stamp, and record it. It reads https://your.server/@you/…'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['mastodon-post'], near: { 'mastodon-profile': 'wrong format: this is a profile link, not a post' } },
    linkExample: 'https://mastodon.social/@you/112345678901234567',
    samples: { valid: ['https://mastodon.social/@you/112345678901234567', 'https://fosstodon.org/@you/112345678901234567', 'https://mastodon.social/@Gargron/103270115826048975'], wrongFormat: ['https://mastodon.social/@you'], wrongPlatform: ['https://x.com/you/status/1712345678901234567'] }
  },
  {
    id: 'telegram', name: 'Telegram channel post', short: 'Telegram', platform: 'telegram', venue: 'social-telegram', template: 'telegram-post', linkShape: true,
    summary: 'A post in your public channel; every post gets its own t.me link.',
    specs: [
      s('Text limit (Bot API)', '4,096 characters for a message; 1,024 for a photo or video caption', SRC.tgBotApi),
      s('Album', '2 to 10 photos or videos in one post (Bot API)', SRC.tgBotApi),
      s('File size', 'Files of any type up to 2 GB (4 GB with Premium)', SRC.tgFaq),
      s('Video length', null, ''),
      s('Links', 'Links get a preview; posting from the app shows it', SRC.tgBotApi),
      s('Hashtags', 'Tapping a hashtag shows the channel\'s other posts with it', SRC.tgChannels),
      s('Post link', 't.me/{channel}/{id}; every post in a public channel has one', SRC.tgLinks)
    ],
    upload: [FILE.square, FILE.reel + ' (a video post)'],
    steps: [
      'In your channel, attach the square image or the Reel.',
      'Paste the text from Draft (template telegram-post): within 1,024 characters when it is a caption under media.',
      'One link; let the preview show.',
      'Post, then the post menu, Copy link, and record it. It must read t.me/yourchannel/…'
    ],
    redLines: RL.chat.concat(RL.common),
    url: { accept: ['tg-post'], soft: { 'tg-private-post': 'A t.me/c/ link opens only for members of a private channel: fine if the channel is private on purpose.' }, near: { 'tg-channel': 'wrong format: this is the channel\'s link, not the post\'s (t.me/yourchannel/<number>)' } },
    linkExample: 'https://t.me/yourchannel/42',
    samples: { valid: ['https://t.me/yourchannel/42', 'https://t.me/s/yourchannel/42'], wrongFormat: ['https://t.me/yourchannel'], wrongPlatform: ['https://whatsapp.com/channel/0029VaAbCdEfGhIjKlMn0a/123'] }
  },
  {
    id: 'threads', name: 'Threads post', short: 'Threads', platform: 'threads', venue: 'social-threads', template: 'threads-post', linkShape: true,
    summary: 'Short text with the video or an image; a link shows as a preview.',
    specs: [
      s('Text limit', '500 characters', SRC.threadsLaunch),
      s('Longer text', 'A text attachment of up to 10,000 characters', SRC.threadsAttach),
      s('Video', 'Up to 5 minutes', SRC.threadsLaunch),
      s('Video (API)', 'MOV or MP4, up to 5 minutes and 1 GB; 9:16 recommended', SRC.threadsApi),
      s('Images (API)', 'JPEG or PNG, 8 MB, 320 to 1440 pixels wide; up to 20 items in a carousel', SRC.threadsApi),
      s('Links', 'At most 5 links a post; a link attachment shows a preview', SRC.threadsApi),
      s('Tags', 'One topic tag per post', SRC.threadsTopics),
      s('Post link', null, '')
    ],
    upload: [FILE.reel, FILE.square + ' (an image post instead)'],
    steps: [
      'New thread, attach reel-<tool>.mp4 or the square image.',
      'Paste the text from Draft (template threads-post), within 500 characters, with one link.',
      'Add one topic tag that fits the tool.',
      'Post, then Share, Copy link, and record it. Expect threads.net/@you/post/… (or threads.com).'
    ],
    redLines: RL.social.concat(RL.common),
    url: { accept: ['threads-post'], near: { 'threads-profile': 'wrong format: this is a profile link, not a post' } },
    linkExample: 'https://www.threads.net/@you/post/C1a2B3c4D5e',
    samples: { valid: ['https://www.threads.net/@you/post/C1a2B3c4D5e', 'https://www.threads.com/@you/post/C1a2B3c4D5e?xmt=abc'], wrongFormat: ['https://www.threads.net/@you'], wrongPlatform: ['https://www.instagram.com/p/C1a2B3c4D5e/'] }
  },
  {
    id: 'whatsapp-status', name: 'WhatsApp Status', short: 'WA Status', platform: 'whatsapp', venue: 'social-whatsapp-status', template: 'whatsapp-broadcast', linkShape: false, tick: true,
    summary: 'A 24-hour status for your contacts; it has no public link, so it is ticked, not linked.',
    specs: [
      s('Aspect ratio', '9:16 recommended for Status', SRC.metaAspect),
      s('Lifetime', 'Disappears after 24 hours', SRC.waStatusBlog),
      s('Links', 'A link in a status shows a preview of the page', SRC.waStatusBlog),
      s('Video length', null, 'https://faq.whatsapp.com/454876960047011'),
      s('File type and size', null, 'https://faq.whatsapp.com/454876960047011'),
      s('Text limit', null, '')
    ],
    upload: [FILE.story, FILE.reel + ' (check the length the app allows)'],
    steps: [
      'Status, then the camera or pencil: pick story-1080x1920.png or the Reel.',
      'Add one line and the tool\'s link from kit.md; it shows as a preview.',
      'Only your contacts see it: never add people to reach more.',
      'Post, then press Posted (tick) on the calendar row. A status has no link to record.'
    ],
    redLines: RL.chat.concat(RL.common),
    url: { accept: [], tickOnly: 'WhatsApp Status has no public link: press Posted (tick) instead.' },
    linkExample: '',
    samples: { valid: [], wrongFormat: ['https://wa.me/447700900123'], wrongPlatform: ['https://t.me/yourchannel/42'] }
  },
  {
    id: 'whatsapp-channel', name: 'WhatsApp Channel', short: 'WA Channel', platform: 'whatsapp', venue: 'social-whatsapp', template: 'whatsapp-broadcast', linkShape: true, tick: true,
    summary: 'A one-way update to people who chose to follow your channel.',
    specs: [
      s('What you can send', 'Text, photos, videos, stickers and polls', SRC.waChannelsBlog),
      s('History', 'Channel history is kept on WhatsApp\'s servers for up to 30 days', SRC.waChannelsBlog),
      s('Sharing the channel', 'Share the channel link or its QR code in your Status and chats', SRC.waChannels),
      s('Message limit', null, 'https://faq.whatsapp.com/290544379966533'),
      s('Media limits', null, ''),
      s('Update link', null, '')
    ],
    upload: [FILE.square, FILE.reel + ' (a video update)'],
    steps: [
      'Open your channel, attach square-1080.png or the Reel.',
      'Paste the text from Draft (template whatsapp-broadcast): one tool, one link.',
      'Send. If WhatsApp gives you a link to the update, record it; otherwise press Posted (tick).'
    ],
    redLines: RL.chat.concat(RL.common),
    url: { accept: ['wa-channel-update'], soft: { 'wa-channel': 'this looks like the channel\'s own link rather than the update\'s: fine if WhatsApp offers nothing else' }, near: { 'wa-other': 'wrong format: this is a chat or contact link, not a channel update' } },
    linkExample: 'https://whatsapp.com/channel/0029VaAbCdEfGhIjKlMn0a/123',
    samples: { valid: ['https://whatsapp.com/channel/0029VaAbCdEfGhIjKlMn0a/123', 'https://www.whatsapp.com/channel/0029VaAbCdEfGhIjKlMn0a'], wrongFormat: ['https://wa.me/447700900123', 'https://chat.whatsapp.com/AbCdEfGhIjK'], wrongPlatform: ['https://t.me/yourchannel/42'] }
  }
];

/* Does the post itself carry a clickable link? Where it does not (the link lives
   in the profile: Instagram feed and Reels, TikTok, YouTube Shorts per SRC.ytLinks,
   a native Facebook Reel), the desk logs the post as a profile-link post: it does
   NOT count toward the linked-post caps or the day's routine cap, and the channel
   gets frequency ADVICE instead (shown, never a block). A Pinterest pin carries
   its destination link unless you record it with "no link". */
const LINK_IN_POST = {
  'instagram-reel': false, 'instagram-carousel': false, 'instagram-story': true, 'facebook-reel': false, 'facebook-post': true,
  'youtube-shorts': false, tiktok: false, 'pinterest-video': true, 'pinterest-image': true, 'linkedin-post': true, 'linkedin-document': true,
  x: true, threads: true, bluesky: true, mastodon: true, telegram: true, 'whatsapp-status': true, 'whatsapp-channel': true
};
/* The desk's own advice (not a platform rule): how many profile-link posts of a
   kind one account should put out in a day. `group` shares the count. */
const ADVICE = {
  'instagram-reel': { perDay: 2, group: ['instagram-reel'], what: 'Reels' },
  'instagram-carousel': { perDay: 2, group: ['instagram-carousel'], what: 'feed posts' },
  'facebook-reel': { perDay: 2, group: ['facebook-reel'], what: 'Facebook Reels' },
  'youtube-shorts': { perDay: 2, group: ['youtube-shorts'], what: 'Shorts' },
  tiktok: { perDay: 2, group: ['tiktok'], what: 'TikTok videos' }
};
for (const c of CHANNELS) {
  c.linkInPost = LINK_IN_POST[c.id] !== false;
  c.noLinkOption = c.id === 'pinterest-video' || c.id === 'pinterest-image' || c.id === 'facebook-post';
  if (ADVICE[c.id]) c.advice = ADVICE[c.id];
}

/* ---------------------------------------------------------- link rules */

const MASTODON_PATH = /^\/@[A-Za-z0-9_.]+(@[A-Za-z0-9.-]+)?\/(\d{6,})\/?$|^\/users\/[A-Za-z0-9_.]+\/statuses\/(\d{6,})\/?$/;

/** What a link is, from its shape alone: { platform, kind, https, host }. Never fetched. */
function classify(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch (e) { return { platform: '', kind: 'not-a-link', https: false, host: '' }; }
  if (!/^https?:$/.test(u.protocol)) return { platform: '', kind: 'not-a-link', https: false, host: '' };
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
  const p = u.pathname;
  const out = (platform, kind) => ({ platform, kind, https: u.protocol === 'https:', host });
  if (host === 'instagram.com' || host === 'instagr.am') {
    if (/^\/(?:[A-Za-z0-9._]+\/)?reels?\/[A-Za-z0-9_-]+\/?$/.test(p)) return out('instagram', 'ig-reel');
    if (/^\/(?:[A-Za-z0-9._]+\/)?(p|tv)\/[A-Za-z0-9_-]+\/?$/.test(p)) return out('instagram', 'ig-feed');
    if (/^\/stories\/(highlights\/\d+|[A-Za-z0-9._]+\/\d+)\/?$/.test(p)) return out('instagram', 'ig-story');
    if (/^\/[A-Za-z0-9._]+\/?$/.test(p)) return out('instagram', 'ig-profile');
    return out('instagram', 'ig-other');
  }
  if (host === 'fb.watch') return out('facebook', 'fb-short');
  if (host === 'facebook.com' || host === 'fb.com') {
    if (/^\/reel\/\d+\/?$/.test(p) || /^\/share\/r\/[A-Za-z0-9_-]+\/?$/.test(p)) return out('facebook', 'fb-reel');
    if (/^\/groups\/[^/]+\/(posts|permalink)\/\d+/.test(p)) return out('facebook', 'fb-group-post');
    if (/^\/share\/p\/[A-Za-z0-9_-]+\/?$/.test(p) || /^\/[^/]+\/posts\/[A-Za-z0-9]+\/?$/.test(p) || /^\/(permalink|story)\.php$/.test(p) && u.searchParams.get('story_fbid') || /^\/photo(\.php|\/)?$/.test(p) && u.searchParams.get('fbid') || /^\/[^/]+\/photos\/[^/]+\/\d+/.test(p)) return out('facebook', 'fb-post');
    if (/^\/share\/v\/[A-Za-z0-9_-]+\/?$/.test(p) || /^\/[^/]+\/videos\/(?:[^/]+\/)?\d+\/?$/.test(p) || /^\/watch\/?$/.test(p) && u.searchParams.get('v')) return out('facebook', 'fb-video');
    return out('facebook', 'fb-other');
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    if (host === 'youtu.be') return out('youtube', /^\/[A-Za-z0-9_-]{6,}\/?$/.test(p) ? 'yt-watch' : 'yt-other');
    if (/^\/shorts\/[A-Za-z0-9_-]{6,}\/?$/.test(p)) return out('youtube', 'yt-short');
    if (p === '/watch' && u.searchParams.get('v')) return out('youtube', 'yt-watch');
    if (/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?/.test(p)) return out('youtube', 'yt-channel');
    return out('youtube', 'yt-other');
  }
  if (/(^|\.)tiktok\.com$/.test(host)) {
    if (/^(vm|vt)\.tiktok\.com$/.test(host) || /^\/t\/[A-Za-z0-9]+\/?$/.test(p)) return out('tiktok', 'tt-short');
    if (/^\/@[^/]+\/video\/\d+\/?$/.test(p)) return out('tiktok', 'tt-video');
    if (/^\/@[^/]+\/photo\/\d+\/?$/.test(p)) return out('tiktok', 'tt-photo');
    if (/^\/@[^/]+\/?$/.test(p)) return out('tiktok', 'tt-profile');
    return out('tiktok', 'tt-other');
  }
  if (host === 'pin.it') return out('pinterest', 'pin-short');
  if (/(^|\.)pinterest\.(com|co\.uk|ca|de|fr|es|it|com\.au|com\.mx|jp|at|ch|cl|co\.kr|dk|ie|nz|ph|pt|se|ru|in|nl|be)$/.test(host)) {
    if (/^\/pin\/(?:[A-Za-z0-9-]*--)?\d+\/?$/.test(p)) return out('pinterest', 'pin');
    return out('pinterest', 'pin-other');
  }
  if (host === 'lnkd.in') return out('linkedin', 'li-short');
  if (/(^|\.)linkedin\.com$/.test(host)) {
    if (/^\/posts\/[^/]*(activity|ugcpost|share)-\d+/i.test(p)) return out('linkedin', 'li-post');
    if (/^\/feed\/update\/urn(:|%3A)li(:|%3A)(activity|share|ugcPost)(:|%3A)\d+\/?$/i.test(p)) return out('linkedin', 'li-post');
    if (/^\/pulse\//.test(p)) return out('linkedin', 'li-article');
    return out('linkedin', 'li-other');
  }
  if (host === 't.co') return out('x', 'x-short');
  if (host === 'x.com' || host === 'twitter.com') {
    if (/^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(p) || /^\/i\/(web\/)?status\/\d+\/?$/.test(p)) return out('x', 'x-post');
    if (/^\/[A-Za-z0-9_]{1,15}\/?$/.test(p)) return out('x', 'x-profile');
    return out('x', 'x-other');
  }
  if (host === 'threads.net' || host === 'threads.com') {
    if (/^\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+\/?$/.test(p)) return out('threads', 'threads-post');
    return out('threads', 'threads-profile');
  }
  if (host === 'bsky.app') {
    if (/^\/profile\/[^/]+\/post\/[a-z0-9]{6,}\/?$/.test(p)) return out('bluesky', 'bsky-post');
    if (/^\/profile\/[^/]+\/?$/.test(p)) return out('bluesky', 'bsky-profile');
    return out('bluesky', 'bsky-other');
  }
  if (host === 't.me' || host === 'telegram.me') {
    if (/^\/c\/\d+\/\d+\/?$/.test(p)) return out('telegram', 'tg-private-post');
    if (/^\/(s\/)?[A-Za-z0-9_]{4,}\/\d+\/?$/.test(p)) return out('telegram', 'tg-post');
    if (/^\/(s\/)?[A-Za-z0-9_]{4,}\/?$/.test(p)) return out('telegram', 'tg-channel');
    return out('telegram', 'tg-other');
  }
  if (host === 'whatsapp.com' || host === 'wa.me' || host === 'chat.whatsapp.com' || host === 'api.whatsapp.com') {
    if (host === 'whatsapp.com' && /^\/channel\/[A-Za-z0-9]+\/\d+\/?$/.test(p)) return out('whatsapp', 'wa-channel-update');
    if (host === 'whatsapp.com' && /^\/channel\/[A-Za-z0-9]+\/?$/.test(p)) return out('whatsapp', 'wa-channel');
    return out('whatsapp', 'wa-other');
  }
  // any other server: a Mastodon post has the shape https://<instance>/@user/<id>
  if (MASTODON_PATH.test(p)) return out('mastodon', 'mastodon-post');
  if (/^\/@[A-Za-z0-9_.]+(@[A-Za-z0-9.-]+)?\/?$/.test(p)) return out('mastodon', 'mastodon-profile');
  return out('', 'unknown');
}

const PLATFORM_NAME = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', mastodon: 'Mastodon', telegram: 'Telegram', whatsapp: 'WhatsApp' };

/** Does this link fit this channel and its format? Shape only: the desk never opens it. */
function check(channelId, url) {
  const ch = get(channelId);
  const issues = [];
  const bad = (code, msg) => issues.push({ code, level: 'bad', msg });
  const warn = (code, msg) => issues.push({ code, level: 'warn', msg });
  if (!ch) return { ok: false, platform: '', kind: '', issues: [{ code: 'unknown-channel', level: 'bad', msg: 'Unknown channel ' + channelId + '.' }] };
  const text = String(url || '').trim();
  if (!text) return { ok: false, platform: '', kind: '', issues: [{ code: 'empty', level: 'bad', msg: 'No link.' }] };
  const c = classify(text);
  if (c.kind === 'not-a-link') { bad('not-a-link', 'This is not a web link: paste the address that starts with https://'); return { ok: false, platform: '', kind: c.kind, issues }; }
  if (!c.https) bad('not-https', 'The link is not https: copy it again from the app\'s Share or Copy link.');
  if (ch.url.tickOnly) {
    bad('no-link-channel', ch.url.tickOnly);
  } else if (c.platform !== ch.platform) {
    bad('wrong-platform', 'Wrong platform: this is ' + (c.platform ? 'a ' + PLATFORM_NAME[c.platform] + ' link' : 'not a link to any channel the desk knows') + ', the target is ' + ch.name + '.');
  } else if (ch.url.accept.includes(c.kind)) {
    if (ch.url.warnAlways) warn('cannot-see-format', ch.url.warnAlways);
  } else if (ch.url.soft && ch.url.soft[c.kind]) {
    warn('short-link', ch.url.soft[c.kind]);
    if (ch.url.warnAlways) warn('cannot-see-format', ch.url.warnAlways);
  } else if (ch.url.near && ch.url.near[c.kind]) {
    bad('wrong-format', ch.url.near[c.kind]);
  } else {
    bad('unrecognised', 'This ' + PLATFORM_NAME[c.platform] + ' link does not have the shape of ' + (/^[aeiou]/i.test(ch.name) ? 'an ' : 'a ') + ch.name + (ch.linkExample ? ' (' + ch.linkExample.replace(/^https:\/\/(www\.)?/, '') + ')' : '') + ': open the post itself and copy its link.');
  }
  return { ok: !issues.some((x) => x.level === 'bad'), platform: c.platform, kind: c.kind, issues };
}

/* ----------------------------------------------------------- the cards */

function list() { return CHANNELS; }
function get(id) { return CHANNELS.find((c) => c.id === id) || null; }

/** Channels as Guide cards, with the desk's own cadence for each venue (from the register and log.js). */
function cards() {
  let V = null;
  let L = null;
  try { V = require('./venues'); L = require('./log'); } catch (e) { /* the cards still work without the register */ }
  return CHANNELS.map((c) => {
    let venueName = '';
    let cadence = '';
    if (c.venue && V) {
      const v = V.get(c.venue);
      if (v) {
        venueName = v.name;
        const tc = (L && L.TEMPLATE_CAPS[c.template]) || {};
        const days = Math.max(v.cadenceDays || 0, tc.days || 0);
        const week = Math.min(v.maxPerWeek > 0 ? v.maxPerWeek : 999, tc.perWeek || 999);
        cadence = c.linkInPost
          ? 'Counts as a linked post: at most one every ' + days + ' day' + (days === 1 ? '' : 's') + ' and ' + week + ' a week on ' + v.name + ' (venue register and the ' + c.template + ' template), shared with the Today routine' + (c.noLinkOption ? '; record it with "no link" when the post carries none' : '') + '.'
          : 'A profile-link post (the post itself has no clickable link): logged, but not counted toward the linked-post caps or the day\'s routine cap.' + (c.advice ? ' The desk\'s advice, not a platform rule: at most ' + c.advice.perDay + ' ' + c.advice.what + ' a day per account.' : '');
      }
    }
    let budget = null;
    if (c.platform === 'facebook' && L) { try { budget = L.fbBudget(); } catch (e) { budget = null; } }
    return {
      id: c.id, name: c.name, short: c.short, platform: c.platform, summary: c.summary, venue: c.venue, venueName, cadence, template: c.template,
      specs: c.specs, upload: c.upload, steps: c.steps, redLines: c.redLines, linkExample: c.linkExample, tick: !!c.tick, linkShape: !!c.linkShape,
      linkInPost: c.linkInPost, noLinkOption: !!c.noLinkOption, advice: c.advice || null, budget
    };
  });
}

module.exports = { CHECKED, NC, SRC, list, get, classify, check, cards, PLATFORM_NAME, LINK_IN_POST, ADVICE };
