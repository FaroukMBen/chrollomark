/**
 * Adblock 2.0 - High Performance Content Shield
 * Based on common EasyList and uBlock filtering patterns.
 */

// Comprehensive list of ad-serving and tracking domains
export const ADBLOCK_DOMAIN_LIST = [
  // Major Ad Networks
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adnxs.com',
  'adtech.de', 'advertising.com', 'amazon-adsystem.com', 'bidswitch.net',
  'casalemedia.com', 'criteo.com', 'flashtalking.com', 'mookie1.com',
  'openx.net', 'pubmatic.com', 'quantserve.com', 'rubiconproject.com',
  'scorecardresearch.com', 'smartadserver.com', 'taboola.com', 'outbrain.com',
  
  // Tracking & Analytics
  'google-analytics.com', 'hotjar.com', 'mouseflow.com', 'mixpanel.com',
  'segment.com', 'facebook.net', 'facebook.com/tr', 'googletagmanager.com',
  
  // Aggregator specific ad-servers (Common on Manga/Reading sites)
  'popads.net', 'propellerads.com', 'ad-maven.com', 'a-ads.com', 
  'juicyads.com', 'exoclick.com', 'ero-advertising.com', 'onclickads.net',
  'mgid.com', 'revcontent.com', 'yandex.ru/ads', 'aniview.com',
  'witnessvaca.top', 'mobsid.com', 'traffichaus.com'
];

/**
 * JavaScript to be injected at document_start.
 * Uses MutationObserver for proactive removal and CSS for declarative hiding.
 */
export const ADBLOCK_INJECTED_JS = `
  (function() {
    // 1. Comprehensive CSS Blocklist (EasyList style)
    const adStyles = \`
      /* Common Ad Selectors */
      .ad, .ads, .ad-container, .adsbygoogle, .sidebar-ads, .banner-ad, 
      .sponsored-card, .sponsored-content, .ads-label, [id*="google_ads_iframe"], 
      [id*="taboola-"], [class*="AdRoot"], iframe[src*="ads"], 
      iframe[src*="doubleclick"], .pop-up, .overlay-ad, .sticky-ad,
      
      /* Specific Aggregator Ad Blocks */
      #top-banner, #bottom-banner, .manga-ads, .reading-ads,
      .native-ad, .outbrain_widget, .taboola-main,
      
      /* Block layout shifts from hidden ads */
      ins.adsbygoogle { display: none !important; height: 0 !important; width: 0 !important; visibility: hidden !important; }
    \`;

    const style = document.createElement('style');
    style.innerHTML = adStyles;
    document.documentElement.appendChild(style);

    // 2. Proactive DOM Cleanup (MutationObserver)
    const adSelectors = [
      '.ad-container', '.adsbygoogle', '.sidebar-ads', 'iframe[src*="ads"]',
      '[id*="google_ads_iframe"]', '.overlay-ad', '.pop-up', '[class*="AdRoot"]'
    ];

    const cleanup = () => {
      adSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el.parentNode) el.remove();
        });
      });
      // Also remove elements with "ad" in id/class if they look suspicious
      document.querySelectorAll('[id*="ScriptRoot"], [class*="ScriptRoot"]').forEach(el => el.remove());
    };

    const observer = new MutationObserver((mutations) => {
      cleanup();
    });

    // Start observing as early as possible
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // 3. Initial cleanup
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cleanup);
    } else {
      cleanup();
    }

    // 4. URL Communication (Keep only navigation tracking)
    function trackNav() {
       window.ReactNativeWebView.postMessage(JSON.stringify({
         type: 'NAV_CHANGE',
         url: window.location.href,
         title: document.title
       }));
    }

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        trackNav();
      }
    }, 1000);

    trackNav();
  })();
  true;
`;
