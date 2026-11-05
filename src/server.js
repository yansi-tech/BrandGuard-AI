const path = require('path');
const express = require('express');
const { port } = require('./config');
const { checkConnection } = require('./db');
const rules = require('./services/rule-service');
const reviews = require('./services/review-service');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../public')));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/', asyncRoute(async (req, res) => {
  const data = await reviews.dashboardData();
  res.render('dashboard', { page: 'dashboard', ...data });
}));

app.get('/review/new', (req, res) => {
  res.render('new-review', { page: 'review', contentTypes: reviews.contentTypes });
});

app.get('/review/:id', asyncRoute(async (req, res) => {
  const data = await reviews.getReview(req.params.id);
  res.render('review-detail', { page: 'review', ...data });
}));

app.get('/knowledge', asyncRoute(async (req, res) => {
  const brandRules = await rules.listRules();
  res.render('knowledge', { page: 'knowledge', brandRules, ruleTypes: rules.VALID_TYPES });
}));

app.get('/api/rules', asyncRoute(async (_req, res) => res.json({ rules: await rules.listRules() })));
app.post('/api/rules', asyncRoute(async (req, res) => {
  const rule = await rules.createRule(req.body);
  res.status(201).json({ rule });
}));
app.delete('/api/rules/:id', asyncRoute(async (req, res) => {
  await rules.deleteRule(Number(req.params.id));
  res.status(204).end();
}));

app.post('/api/reviews', asyncRoute(async (req, res) => {
  const result = await reviews.createReview(req.body);
  res.status(201).json({ reviewId: result.id, analysisMode: result.analysisMode, aiNotice: result.aiNotice, summary: result.summary });
}));
app.get('/api/reviews/:id', asyncRoute(async (req, res) => res.json(await reviews.getReview(req.params.id))));
app.post('/api/reviews/:id/issues/:issueId/decision', asyncRoute(async (req, res) => {
  await reviews.setIssueDecision(req.params.id, req.params.issueId, req.body.decision);
  res.json({ ok: true });
}));
app.post('/api/reviews/:id/issues/:issueId/apply', asyncRoute(async (req, res) => {
  const content = await reviews.applySuggestion(req.params.id, req.params.issueId);
  res.json({ content });
}));
app.post('/api/reviews/:id/submit', asyncRoute(async (req, res) => {
  await reviews.submitForReview(req.params.id, req.body.content, req.body.note);
  res.json({ ok: true, status: 'IN_REVIEW' });
}));
app.post('/api/reviews/:id/action', asyncRoute(async (req, res) => {
  await reviews.reviewerAction(req.params.id, req.body.action, req.body.comment);
  res.json({ ok: true, status: req.body.action === 'APPROVE' ? 'APPROVED' : 'REVISION_REQUESTED' });
}));
app.post('/api/reviews/:id/comments', asyncRoute(async (req, res) => {
  await reviews.addComment(req.params.id, req.body.comment, req.body.author || 'Reviewer');
  res.status(201).json({ ok: true });
}));

app.use((req, res) => res.status(404).render('error', { page: '', status: 404, message: 'The page you requested does not exist.' }));
app.use((error, req, res, _next) => {
  console.error(error);
  const status = /required|invalid|cannot|must|Select|empty|not found/i.test(error.message) ? 400 : 500;
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: error.message || 'Something went wrong. Please try again.' });
  res.status(status).render('error', { page: '', status, message: error.message || 'Something went wrong. Please try again.' });
});

checkConnection()
  .then(() => app.listen(port, '0.0.0.0', () => {
  console.log(`BrandGuard AI is running on port ${port}`);
}))
  .catch((error) => {
    console.error('Unable to connect to MySQL. Set DB_* values in .env and run `npm run db:init`.');
    console.error(error.message);
    process.exit(1);
  });
