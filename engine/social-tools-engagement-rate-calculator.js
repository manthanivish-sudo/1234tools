/**
 * Engagement Rate Calculator — the spec build-social.js reads. The formulas
 * are in engine/social-engagement-rate-calculator.js (SocialER.compute). No
 * benchmark or "good rate" is given anywhere on the page.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['engagement-rate-calculator'] = {
    order: 4,
    title: 'Engagement Rate Calculator',
    pageTitle: 'Engagement Rate Calculator — By Followers & By Reach | 1234Tools',
    description: 'Work out an engagement rate the ways people quote it — by followers, by reach, by impressions, likes and comments only, and per post — side by side from likes, comments, shares, saves and followers, each with its formula. Free, in your browser.',
    keywords: ['engagement rate calculator', 'instagram engagement rate', 'engagement rate formula', 'engagement rate by reach', 'engagement rate by followers',
      'tiktok engagement rate', 'linkedin engagement rate', 'how to calculate engagement rate', 'average engagement per post', 'engagement rate by impressions'],
    glyph: 'i-social-rate',
    glyphSvg: '<symbol id="i-social-rate" viewBox="0 0 24 24">\n  <path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z"/>\n  <path d="M8.5 13.5l2-2 2 1.5 3-3.5" class="thin"/>\n</symbol>',
    category: 'BusinessApplication',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-kit.js', '/engine/social-engagement-rate-calculator.js'],
    privacy: 'Nothing you type is uploaded: the sums are done in this page. Your figures are not stored; only the number of decimal places you choose is remembered in this browser. There is no account.',
    how: [
      'Enter the likes, comments, shares and saves of a post, and your follower count. Leave any you do not have at 0.',
      'Add reach and impressions if your platform’s insights show them: they unlock the rates by reach and by impressions.',
      'For an average over several posts, enter the totals for all of them and the number of posts.',
      'Read the five results side by side, each with its formula and the sum that produced it.',
      'Press Copy results to paste every rate, with its working, into a report or a message.'
    ],
    uses: [
      ['Reporting to a client', 'Quote the rate with its formula, so nobody compares a rate by reach with one by followers.'],
      ['Checking a post against your own average', 'Work out your average per post over the last ten posts, then a single post, with the same formula.'],
      ['Comparing two accounts fairly', 'Use the same formula and the same kind of posts for both.'],
      ['Pitching to a brand', 'Show the per-post average and the rate by reach together.']
    ],
    tips: [
      'Say which formula you used every time you quote a rate: by followers and by reach can differ a lot for the same post.',
      'Compare like with like — the same formula, the same platform, the same kind of post.',
      'Reach is the better base when many of your viewers do not follow you; followers is the one you can check for any public account.',
      'Copy the figures from the platform’s own insights for the same dates; reach and impressions change for days after posting.',
      'Leave saves at 0 on a platform that does not show them, and say so when you share the rate.'
    ],
    faq: [
      { q: 'Which engagement rate formula is right?', a: 'None is the official one; they answer different questions. By followers asks how much of your audience responded. By reach asks how many of the people who saw the post responded. By impressions counts each view. This page shows them side by side so you can quote the one that fits and name it.' },
      { q: 'Why can reach be higher than my followers?', a: 'Reach counts every account that saw the post, including people who do not follow you — from shares, hashtags, search or recommendations. The calculator accepts it and says so; it is why the rate by reach can be lower than the rate by followers.' },
      { q: 'What counts as an engagement here?', a: 'Likes, comments, shares and saves, added up. The “likes and comments” rate leaves out shares and saves, for comparing with figures quoted that way.' },
      { q: 'How do I average over several posts?', a: 'Add up the likes, comments, shares and saves of all the posts, add up their reach and impressions, and enter the number of posts. The rate by followers then divides by the number of posts as well, so it is the average rate per post.' },
      { q: 'What is a good engagement rate?', a: 'This page does not say. Published averages disagree, depend on the platform, the size of the account and the formula, and go out of date. Your own average, worked out the same way over your recent posts, is the fairest thing to compare a post with.' },
      { q: 'Are my numbers stored?', a: 'No. They stay in this page while it is open. Only the number of decimal places is remembered in this browser.' }
    ],
    related: ['/mathematics/percentage/', '/ai/social-post-writer/', '/image/social-media-resizer/']
  };
})();
