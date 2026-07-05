const axios = require('axios');
const cheerio = require('cheerio');

// In-memory cache to avoid hitting the RSS feed on every request
let cachedNews = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

exports.getNewsFeed = async (req, res) => {
  try {
    if (cachedNews && Date.now() - cacheTime < CACHE_DURATION) {
      return res.json({ status: 'ok', items: cachedNews });
    }

    const rssUrl = "https://www.animenewsnetwork.com/news/rss.xml";
    const response = await axios.get(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((i, el) => {
      const title = $(el).find('title').text();
      const link = $(el).find('link').text();
      const pubDate = $(el).find('pubDate').text();
      let description = $(el).find('description').text();

      // Extract categories
      const categories = [];
      $(el).find('category').each((j, cat) => {
        categories.push($(cat).text());
      });

      // Try to extract image from description or enclosure
      let thumbnail = '';
      const enclosure = $(el).find('enclosure').attr('url');
      if (enclosure) {
        thumbnail = enclosure;
      } else {
        const descHtml = cheerio.load(description);
        const img = descHtml('img').first().attr('src');
        if (img) thumbnail = img;
      }

      if (!thumbnail) {
        thumbnail = "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=640&auto=format&fit=crop";
      }

      // Clean description
      description = description.replace(/<[^>]*>/g, '').trim();

      items.push({
        title,
        link,
        pubDate,
        description,
        thumbnail,
        categories
      });
    });

    cachedNews = items;
    cacheTime = Date.now();

    res.json({ status: 'ok', items });
  } catch (error) {
    console.error("Error fetching news feed:", error.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch news feed' });
  }
};

exports.getArticleContent = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ status: 'error', message: 'URL is required' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    let articleHtml = '';
    let title = '';
    let sourceName = 'External Source';

    if (url.includes('animenewsnetwork.com')) {
      sourceName = 'Anime News Network';
      title = $('h1#page-title').text() || $('h1').first().text();

      // The main content in ANN is usually in the .text-zone or #maincontent
      const mainContent = $('.text-zone').length ? $('.text-zone') : $('.meat');

      // Clean up ads, social buttons, etc.
      mainContent.find('.social-buttons, .ad, .sponsor, script, .right-column, .sidebar').remove();

      // Fix relative image paths and lazyloaded sources
      mainContent.find('img').each((i, el) => {
        let src = $(el).attr('data-src') || $(el).attr('src');
        if (src) {
          if (src.includes('spacer.gif')) {
            $(el).remove();
            return;
          }
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            src = 'https://www.animenewsnetwork.com' + src;
          }
          $(el).attr('src', src);
          $(el).removeAttr('data-src');
          $(el).removeClass('lazyload');
        } else {
          $(el).remove();
        }
      });

      // Fix relative links
      mainContent.find('a').each((i, el) => {
        let href = $(el).attr('href');
        if (href && href.startsWith('/')) {
          $(el).attr('href', 'https://www.animenewsnetwork.com' + href);
        }
        $(el).attr('target', '_blank');
      });

      articleHtml = mainContent.html() || '<p>Content could not be extracted.</p>';
    } else {
      // Generic fallback
      title = $('title').text();
      articleHtml = `<p>Cannot fully parse this source. <a href="${url}" target="_blank">Read original article</a></p>`;
    }

    res.json({
      status: 'ok',
      data: {
        title,
        content: articleHtml,
        sourceName,
        originalUrl: url
      }
    });

  } catch (error) {
    console.error("Error scraping article:", error.message);
    res.status(500).json({ status: 'error', message: 'Failed to extract article content' });
  }
};
