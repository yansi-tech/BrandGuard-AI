const { GoogleGenerativeAI } = require('@google/generative-ai');
const { gemini } = require('../config');

const weights = { critical: 25, high: 15, medium: 7, low: 3 };
const hypeTerms = ['game-changing', 'world-leading', 'unmatched', 'guaranteed', 'revolutionary', 'best-in-class', 'perfect'];
const claimPattern = /\b(?:#1|number one|best|leading|guarantee[ds]?|increase[ds]?|reduce[ds]?|save[ds]?|\d+(?:\.\d+)?%|all customers|every customer)\b/i;

function cleanText(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function makeIssue({ category, severity, problematicText, explanation, supportingSource, suggestedCorrection, requiresHumanVerification = false }) {
  return {
    category: cleanText(category, 80) || 'Guideline',
    severity: ['critical', 'high', 'medium', 'low'].includes(String(severity).toLowerCase()) ? String(severity).toLowerCase() : 'medium',
    problematicText: cleanText(problematicText),
    explanation: cleanText(explanation, 800),
    supportingSource: cleanText(supportingSource, 300) || 'Human verification required',
    suggestedCorrection: cleanText(suggestedCorrection, 800),
    requiresHumanVerification: Boolean(requiresHumanVerification)
  };
}

function localRuleAnalysis(content, rules) {
  const issues = [];
  const lower = content.toLowerCase();
  const prohibited = rules.filter((r) => r.rule_type === 'prohibited');

  for (const rule of prohibited) {
    const term = rule.content.trim();
    if (term && lower.includes(term.toLowerCase())) {
      issues.push(makeIssue({
        category: 'Terminology violation', severity: 'high', problematicText: term,
        explanation: `This uses a prohibited term: “${term}”.`, supportingSource: rule.title,
        suggestedCorrection: term.toLowerCase() === 'revolutionary'
  ? 'innovative'
  : term.toLowerCase() === 'best-in-class'
    ? 'designed for content teams'
    : 'a useful solution'
      }));
    }
  }

  for (const word of hypeTerms) {
    if (lower.includes(word) && !prohibited.some((r) => r.content.trim().toLowerCase() === word)) {
      issues.push(makeIssue({
        category: 'Tone inconsistency', severity: 'medium', problematicText: word,
        explanation: 'This phrasing may read as promotional hype rather than a clear, evidence-led statement.',
        supportingSource: 'Clear, confident, human tone',
        suggestedCorrection: 'Use a precise statement of the product capability and its evidence.'
      }));
    }
  }

  const guidelines = rules.filter((r) => r.rule_type === 'guideline');
  const evidenceRule = guidelines.find((r) => /evidence|claim|source/i.test(`${r.title} ${r.content}`));
  if (claimPattern.test(content)) {
    const matchingFact = rules.filter((r) => r.rule_type === 'fact').some((r) => lower.includes(r.content.toLowerCase().slice(0, 35)));
    if (!matchingFact) {
      const match = content.match(claimPattern);
      issues.push(makeIssue({
        category: 'Unsupported claim', severity: 'high', problematicText: match?.[0] || 'performance claim',
        explanation: 'A claim appears to need an approved fact or external evidence. The automated check cannot verify it.',
        supportingSource: evidenceRule?.title || 'Evidence-led claims',
        suggestedCorrection: 'designed to help customers make informed decisions',
        requiresHumanVerification: true
      }));
    }
  }
  return issues;
}

function extractJson(text) {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return JSON.parse(start >= 0 && end >= start ? body.slice(start, end + 1) : body);
}

async function geminiAnalysis(content, contentType, rules) {
  const ruleContext = rules.map((r) => `[${r.rule_type}] ${r.title}: ${r.content}`).join('\n');
  const prompt = `You are a brand-governance assistant. Review the supplied content only against the approved internal rules below. Do not invent facts, sources, citations, or policies. If a claim cannot be verified from these rules, make the issue require human verification. Return ONLY valid JSON in this exact shape: {"issues":[{"category":"Tone inconsistency|Terminology violation|Unsupported claim|Guideline violation","severity":"critical|high|medium|low","problematicText":"exact short excerpt","explanation":"brief explanation","supportingSource":"exact title of an approved rule, or Human verification required","suggestedCorrection":"concrete rewrite","requiresHumanVerification":true}]}. Return no issue when there is no evidence of a violation.\n\nAPPROVED RULES:\n${ruleContext}\n\nCONTENT TYPE: ${contentType}\nCONTENT:\n${content}`;
  const client = new GoogleGenerativeAI(gemini.apiKey);
  const model = client.getGenerativeModel({ model: gemini.model });
  const result = await model.generateContent(prompt);
  const parsed = extractJson(result.response.text());
  if (!Array.isArray(parsed.issues)) throw new Error('Gemini returned an invalid review format.');
  const knownTitles = new Set(rules.map((rule) => rule.title));
  return parsed.issues.slice(0, 20).map((issue) => {
    const source = knownTitles.has(issue.supportingSource) ? issue.supportingSource : 'Human verification required';
    return makeIssue({ ...issue, supportingSource: source, requiresHumanVerification: issue.requiresHumanVerification || source === 'Human verification required' });
  });
}

function scoreIssues(issues) {
  const deductions = issues.reduce((total, issue) => total + (weights[issue.severity] || weights.medium), 0);
  return { score: Math.max(0, 100 - Math.min(100, deductions)), deductions, weights };
}

async function analyzeContent({ content, contentType, rules }) {
  const localIssues = localRuleAnalysis(content, rules);
  if (!gemini.apiKey) return { issues: localIssues, analysisMode: 'rules_only', aiNotice: 'Gemini is not configured. Results use the local rule engine; human review is still required.' };
  try {
    const aiIssues = await geminiAnalysis(content, contentType, rules);
    const unique = [...localIssues, ...aiIssues].filter((issue, index, all) =>
      all.findIndex((item) => item.category === issue.category && item.problematicText.toLowerCase() === issue.problematicText.toLowerCase()) === index
    );
    return { issues: unique, analysisMode: 'gemini', aiNotice: 'AI findings are advisory and require human judgment before approval.' };
  } catch (error) {
    console.error('Gemini analysis failed:', error.message);
    return { issues: localIssues, analysisMode: 'rules_only', aiNotice: 'Gemini was unavailable, so results use the local rule engine. Human review is required.' };
  }
}

module.exports = { analyzeContent, scoreIssues };
