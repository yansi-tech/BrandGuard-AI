CREATE DATABASE IF NOT EXISTS brandguard_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE brandguard_ai;

CREATE TABLE IF NOT EXISTS brand_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_type ENUM('guideline','preferred','prohibited','fact') NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_reviews (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  content_type VARCHAR(60) NOT NULL,
  original_content MEDIUMTEXT NOT NULL,
  revised_content MEDIUMTEXT NULL,
  status ENUM('DRAFT','IN_REVIEW','APPROVED','REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
  score TINYINT UNSIGNED NULL,
  analysis_mode ENUM('gemini','rules_only') NOT NULL DEFAULT 'rules_only',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_issues (
  id CHAR(36) PRIMARY KEY,
  review_id CHAR(36) NOT NULL,
  category VARCHAR(80) NOT NULL,
  severity ENUM('critical','high','medium','low') NOT NULL,
  problematic_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  supporting_source TEXT NOT NULL,
  suggested_correction TEXT NOT NULL,
  requires_human_verification BOOLEAN NOT NULL DEFAULT FALSE,
  decision ENUM('PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_issue_review FOREIGN KEY (review_id) REFERENCES content_reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_revisions (
  id CHAR(36) PRIMARY KEY,
  review_id CHAR(36) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_revision_review FOREIGN KEY (review_id) REFERENCES content_reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_comments (
  id CHAR(36) PRIMARY KEY,
  review_id CHAR(36) NOT NULL,
  author_name VARCHAR(100) NOT NULL DEFAULT 'Reviewer',
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_review FOREIGN KEY (review_id) REFERENCES content_reviews(id) ON DELETE CASCADE
);

INSERT INTO brand_rules (rule_type, title, content)
SELECT 'guideline', 'Clear, confident, human tone', 'Write in a clear, confident and human voice. Avoid hype, jargon and unsubstantiated superlatives.'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Clear, confident, human tone');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'guideline', 'Evidence-led claims', 'Every performance, leadership or outcome claim needs an approved fact or a verifiable source before publishing.'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Evidence-led claims');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'preferred', 'Preferred: customers', 'customers'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Preferred: customers');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'preferred', 'Preferred: AI-powered', 'AI-powered'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Preferred: AI-powered');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'prohibited', 'Avoid: revolutionary', 'revolutionary'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Avoid: revolutionary');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'prohibited', 'Avoid: best-in-class', 'best-in-class'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Avoid: best-in-class');
INSERT INTO brand_rules (rule_type, title, content)
SELECT 'fact', 'Approved product fact', 'BrandGuard AI helps teams review content against approved brand rules before publication.'
WHERE NOT EXISTS (SELECT 1 FROM brand_rules WHERE title = 'Approved product fact');
