const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// GET /api/news
router.get('/', newsController.getNewsFeed);

// GET /api/news/article
router.get('/article', newsController.getArticleContent);

module.exports = router;
