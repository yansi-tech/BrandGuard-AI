const { v4: uuid } = require('uuid');
const db = require('../db');
const { analyzeContent, scoreIssues } = require('./analysis-service');
const { listRules } = require('./rule-service');

const contentTypes = ['Website copy', 'Social post', 'Email', 'Press release', 'Product content', 'Other'];

async function createReview({ title, content, contentType }) {
  if (!title?.trim() || !content?.trim()) throw new Error('A review title and content are required.');
  if (!contentTypes.includes(contentType)) throw new Error('Select a valid content type.');
  if (content.trim().length > 30000) throw new Error('Content must be 30,000 characters or less.');

  const rules = await listRules();
  const analysis = await analyzeContent({ content: content.trim(), contentType, rules });
  const summary = scoreIssues(analysis.issues);
  const reviewId = uuid();
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT INTO content_reviews (id, title, content_type, original_content, score, analysis_mode) VALUES (?, ?, ?, ?, ?, ?)',
      [reviewId, title.trim(), contentType, content.trim(), summary.score, analysis.analysisMode]
    );
    for (const issue of analysis.issues) {
      await connection.execute(
        `INSERT INTO review_issues (id, review_id, category, severity, problematic_text, explanation, supporting_source, suggested_correction, requires_human_verification)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), reviewId, issue.category, issue.severity, issue.problematicText, issue.explanation, issue.supportingSource, issue.suggestedCorrection, issue.requiresHumanVerification]
      );
    }
    await connection.execute('INSERT INTO review_revisions (id, review_id, content, note) VALUES (?, ?, ?, ?)', [uuid(), reviewId, content.trim(), 'Initial content submitted for analysis']);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { id: reviewId, ...analysis, summary };
}

async function getReview(id) {
  const reviews = await db.query('SELECT * FROM content_reviews WHERE id = ?', [id]);
  if (!reviews.length) throw new Error('Review not found.');
  const [issues, comments, revisions] = await Promise.all([
    db.query('SELECT * FROM review_issues WHERE review_id = ? ORDER BY FIELD(severity, "critical", "high", "medium", "low"), created_at', [id]),
    db.query('SELECT * FROM review_comments WHERE review_id = ? ORDER BY created_at DESC', [id]),
    db.query('SELECT * FROM review_revisions WHERE review_id = ? ORDER BY created_at DESC', [id])
  ]);
  const review = reviews[0];
  const summary = scoreIssues(issues);
  return { review, issues, comments, revisions, summary };
}

async function setIssueDecision(reviewId, issueId, decision) {
  if (!['ACCEPTED', 'REJECTED'].includes(decision)) throw new Error('Invalid suggestion decision.');
  const result = await db.query('UPDATE review_issues SET decision = ? WHERE id = ? AND review_id = ?', [decision, issueId, reviewId]);
  if (!result.affectedRows) throw new Error('Suggestion not found.');
}

async function applySuggestion(reviewId, issueId) {
  const reviewRows = await db.query('SELECT * FROM content_reviews WHERE id = ?', [reviewId]);
  const issueRows = await db.query('SELECT * FROM review_issues WHERE id = ? AND review_id = ?', [issueId, reviewId]);
  if (!reviewRows.length || !issueRows.length) throw new Error('Review or suggestion not found.');
  const review = reviewRows[0];
  const issue = issueRows[0];
  const source = review.revised_content || review.original_content;
  const target = issue.problematic_text;
  if (!target || !source.toLowerCase().includes(target.toLowerCase())) throw new Error('The highlighted text is not available for an automatic replacement. Edit the revised content manually.');
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const revised = source.replace(new RegExp(escaped, 'i'), issue.suggested_correction);
  await db.query('UPDATE content_reviews SET revised_content = ?, status = "DRAFT" WHERE id = ?', [revised, reviewId]);
  await setIssueDecision(reviewId, issueId, 'ACCEPTED');
  await db.query('INSERT INTO review_revisions (id, review_id, content, note) VALUES (?, ?, ?, ?)', [uuid(), reviewId, revised, `Applied suggestion: ${issue.category}`]);
  return revised;
}

async function submitForReview(reviewId, content, note = '') {
  if (!content?.trim()) throw new Error('Revised content cannot be empty.');
  await db.query('UPDATE content_reviews SET revised_content = ?, status = "IN_REVIEW" WHERE id = ?', [content.trim(), reviewId]);
  await db.query('INSERT INTO review_revisions (id, review_id, content, note) VALUES (?, ?, ?, ?)', [uuid(), reviewId, content.trim(), note.trim() || 'Submitted for human review']);
}

async function reviewerAction(reviewId, action, comment) {
  if (!['APPROVE', 'REQUEST_REVISION'].includes(action)) throw new Error('Invalid reviewer action.');
  if (action === 'REQUEST_REVISION' && !comment?.trim()) throw new Error('Add a comment when requesting revisions.');
  const status = action === 'APPROVE' ? 'APPROVED' : 'REVISION_REQUESTED';
  const result = await db.query('UPDATE content_reviews SET status = ? WHERE id = ?', [status, reviewId]);
  if (!result.affectedRows) throw new Error('Review not found.');
  if (comment?.trim()) await addComment(reviewId, comment, 'Reviewer');
}

async function addComment(reviewId, comment, author = 'Reviewer') {
  if (!comment?.trim()) throw new Error('Comment cannot be empty.');
  if (comment.trim().length > 2000) throw new Error('Comment must be 2,000 characters or less.');
  await db.query('INSERT INTO review_comments (id, review_id, author_name, comment_text) VALUES (?, ?, ?, ?)', [uuid(), reviewId, author, comment.trim()]);
}

async function dashboardData() {
  const [counts] = await db.query(`SELECT COUNT(*) total, SUM(status = 'APPROVED') approved, SUM(status = 'IN_REVIEW') pending, COALESCE(SUM((SELECT COUNT(*) FROM review_issues i WHERE i.review_id = content_reviews.id)), 0) violations FROM content_reviews`);
  const recurring = await db.query('SELECT category, COUNT(*) count FROM review_issues GROUP BY category ORDER BY count DESC LIMIT 4');
  const recent = await db.query('SELECT id, title, content_type, status, score, created_at FROM content_reviews ORDER BY updated_at DESC LIMIT 6');
  return { counts: { total: Number(counts.total || 0), approved: Number(counts.approved || 0), pending: Number(counts.pending || 0), violations: Number(counts.violations || 0) }, recurring, recent };
}

module.exports = { contentTypes, createReview, getReview, setIssueDecision, applySuggestion, submitForReview, reviewerAction, addComment, dashboardData };
