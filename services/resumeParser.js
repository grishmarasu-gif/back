/**
 * resumeParser.js
 * Extracts structured data from raw resume text.
 */

// ── Keyword maps ──────────────────────────────────────────────────────────────

const ROLE_KEYWORDS = {
  'Full Stack Developer':      ['react', 'node', 'express', 'mongodb', 'fullstack', 'full stack', 'mern', 'mean'],
  'Frontend Developer':        ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript', 'ui developer', 'frontend'],
  'Backend Developer':         ['node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'backend', 'api developer'],
  'DevOps Engineer':           ['aws', 'docker', 'kubernetes', 'ci/cd', 'jenkins', 'terraform', 'devops', 'cloud'],
  'Data Analyst':              ['sql', 'power bi', 'tableau', 'excel', 'data analysis', 'pandas', 'matplotlib'],
  'Data Scientist':            ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'ai', 'sklearn'],
  'Mobile Developer':          ['flutter', 'react native', 'swift', 'kotlin', 'android', 'ios', 'mobile'],
  'Cloud Engineer':            ['aws', 'azure', 'gcp', 'cloud', 'lambda', 's3', 'ec2'],
  'UI/UX Designer':            ['figma', 'sketch', 'adobe xd', 'ux', 'ui design', 'wireframe', 'prototype'],
  'QA Engineer':               ['selenium', 'cypress', 'jest', 'testing', 'qa engineer', 'automation testing'],
  'Machine Learning Engineer': ['ml', 'machine learning', 'tensorflow', 'pytorch', 'model training', 'feature engineering'],
  'Software Engineer':         ['java', 'c++', 'python', 'algorithms', 'data structures', 'software engineer'],
  'Business Analyst':          ['business analysis', 'requirements', 'stakeholder', 'jira', 'agile', 'scrum'],
  'Product Manager':           ['product manager', 'roadmap', 'kpi', 'product owner', 'sprint planning'],
};

const KNOWN_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxtjs', 'gatsby',
  'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'laravel', 'rails',
  'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'dynamodb', 'cassandra',
  'html', 'css', 'sass', 'tailwindcss', 'bootstrap', 'material ui',
  'sql', 'nosql', 'graphql', 'rest api', 'websocket',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy',
  'linux', 'bash', 'powershell',
  'flutter', 'react native', 'swift', 'kotlin',
];

const KNOWN_TOOLS = [
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'ci/cd',
  'git', 'github', 'gitlab', 'bitbucket', 'firebase', 'postman',
  'tableau', 'power bi', 'excel', 'looker', 'data analysis',
  'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator',
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'vs code', 'webpack',
  'selenium', 'cypress', 'jest', 'mocha', 'pytest',
];

const SECTION_HEADERS = {
  summary:         /\b(summary|profile|about me|objective)\b/i,
  experience:      /\b(experience|work history|employment|professional background)\b/i,
  projects:        /\b(projects|personal projects|academic projects)\b/i,
  education:       /\b(education|academic|qualification|degree|courses)\b/i,
  skills:          /\b(skills|technical skills|competencies|expertise)\b/i,
  tools:           /\b(tools|technologies|stack)\b/i,
  certifications:  /\b(certif|credential|license|award|course)\b/i,
  achievements:    /\b(achievements|awards|honors)\b/i,
  links:           /\b(links|profiles|socials|websites)\b/i,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractPhone(text) {
  const m = text.match(/(\+?[\d\s\-().]{7,17})/);
  return m ? m[0].trim() : '';
}

function extractName(text) {
  // First non-empty line that isn't an email / phone / header keyword
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (
      line.length < 5 || line.length > 60 ||
      /[@|http|www|\d{4}|resume|curriculum|cv\b]/i.test(line)
    ) continue;
    // Must look like a name (2+ words, only letters/hyphens/spaces)
    if (/^[A-Za-z\-'. ]{4,}$/.test(line) && line.split(' ').length >= 2) return line;
  }
  return '';
}

function extractLinkedIn(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i);
  return m ? m[0] : '';
}

function extractGitHub(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i);
  return m ? m[0] : '';
}

function extractPortfolio(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9_-]+\.(?:com|me|dev|io|net))(?!\/in\/)(?!\/)[^\s]*/i);
  if (m && !m[0].includes('linkedin.com') && !m[0].includes('github.com') && !m[0].includes('leetcode.com') && !m[0].includes('hackerrank.com')) {
    return m[0];
  }
  return '';
}

function extractLeetCode(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?leetcode\.com\/[A-Za-z0-9_-]+/i);
  return m ? m[0] : '';
}

function extractHackerRank(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?hackerrank\.com\/[A-Za-z0-9_-]+/i);
  return m ? m[0] : '';
}

function extractYearsExperience(text) {
  const patterns = [
    /(\d+)\+?\s*years?\s*of\s*(?:professional\s*)?experience/i,
    /experience\s*(?:of\s*)?(\d+)\+?\s*years?/i,
    /(\d+)\+?\s*yrs?\s*(?:of\s*)?experience/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

function extractSection(text, headerRegex) {
  const lines = text.split('\n');
  const results = [];
  let inside = false;
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    if (headerRegex.test(clean)) { inside = true; continue; }

    if (inside) {
      // Stop at next major section header
      const isOtherHeader = Object.values(SECTION_HEADERS).some(r => r !== headerRegex && r.test(clean));
      if (isOtherHeader && clean.length < 50) { inside = false; continue; }
      if (clean.length > 5) results.push(clean);
    }
  }
  return results.slice(0, 40); // Allow up to 40 lines per section
}

function extractStructuredExperience(text) {
  const lines = extractSection(text, SECTION_HEADERS.experience);
  if (lines.length === 0) return [];
  
  const expList = [];
  let currentExp = null;
  
  for (const line of lines) {
    // If line has a date-like string (e.g. 2020 - 2022, Jan 2021, Present)
    const hasDate = /(20\d{2}|19\d{2})\s*[-|–|to]+\s*(20\d{2}|present|current)/i.test(line) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4}/i.test(line);
    
    if (hasDate || expList.length === 0) {
      if (currentExp && (currentExp.title || currentExp.company)) {
        expList.push(currentExp);
      }
      currentExp = { company: line, title: '', duration: '', responsibilities: '' };
      
      const dateMatch = line.match(/(?:20\d{2}|19\d{2})\s*[-|–|to]+\s*(?:20\d{2}|present|current)|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4}.*/i);
      if (dateMatch) {
        currentExp.duration = dateMatch[0].trim();
        let stripped = line.replace(dateMatch[0], '').replace(/^[|-]+|[|-]+$/g, '').trim();
        currentExp.company = stripped || 'Unknown Company';
      }
    } else {
      if (!currentExp.title && line.length < 50 && !line.startsWith('•') && !line.startsWith('-')) {
        currentExp.title = line;
      } else {
        currentExp.responsibilities += (currentExp.responsibilities ? '\n' : '') + line;
      }
    }
  }
  if (currentExp && (currentExp.title || currentExp.company)) {
    expList.push(currentExp);
  }
  
  return expList;
}

function extractStructuredProjects(text) {
  const lines = extractSection(text, SECTION_HEADERS.projects);
  if (lines.length === 0) return [];
  
  const projList = [];
  let currentProj = null;
  
  for (const line of lines) {
    if ((line.length < 60 && !line.startsWith('•') && !line.startsWith('-')) || projList.length === 0) {
      if (currentProj && currentProj.title) {
        projList.push(currentProj);
      }
      currentProj = { title: line, techStack: '', description: '' };
      
      // Try to extract tech stack if it's in parentheses or separated by pipes
      const tsMatch = line.match(/\((.*?)\)|\|(.*)/);
      if (tsMatch) {
        currentProj.techStack = (tsMatch[1] || tsMatch[2] || '').trim();
        currentProj.title = line.replace(tsMatch[0], '').trim();
      }
    } else {
      currentProj.description += (currentProj.description ? '\n' : '') + line;
    }
  }
  if (currentProj && currentProj.title) {
    projList.push(currentProj);
  }
  
  return projList;
}

function extractSkillsFromText(text) {
  const lower = text.toLowerCase();
  return [...new Set(KNOWN_SKILLS.filter(skill => lower.includes(skill)))];
}

function extractToolsFromText(text) {
  const lower = text.toLowerCase();
  return [...new Set(KNOWN_TOOLS.filter(tool => lower.includes(tool)))];
}

function suggestRoles(text) {
  const lower = text.toLowerCase();
  const suggestions = [];
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    const hits = keywords.filter(kw => lower.includes(kw)).length;
    if (hits >= 2) suggestions.push({ role, hits });
  }
  return suggestions
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5)
    .map(r => r.role);
}

function guessExperienceLevel(years) {
  if (years <= 0) return null;
  if (years <= 2) return 'Entry-Level (0–2 yrs)';
  if (years <= 5) return 'Mid-Level (2–5 yrs)';
  if (years <= 10) return 'Senior (5+ yrs)';
  return 'Lead / Manager';
}

// ── Main Parser ───────────────────────────────────────────────────────────────

function parseResume(rawText) {
  const text = rawText || '';

  const skills        = extractSkillsFromText(text);
  const tools         = extractToolsFromText(text);
  const technologies  = skills;
  const experience    = extractStructuredExperience(text);
  const projects      = extractStructuredProjects(text);
  const education     = extractSection(text, SECTION_HEADERS.education);
  const certifications = extractSection(text, SECTION_HEADERS.certifications);
  const achievements  = extractSection(text, SECTION_HEADERS.achievements);
  const summaryBlock  = extractSection(text, SECTION_HEADERS.summary).join(' ');
  const yearsOfExperience = extractYearsExperience(text);
  const preferredRoles = suggestRoles(text);
  const experienceLevel = guessExperienceLevel(yearsOfExperience);

  const parsedData = {
    fullName:        extractName(text),
    email:           extractEmail(text),
    phone:           extractPhone(text),
    linkedin:        extractLinkedIn(text),
    github:          extractGitHub(text),
    leetcode:        extractLeetCode(text),
    hackerrank:      extractHackerRank(text),
    portfolio:       extractPortfolio(text),
    summary:         summaryBlock,
    skills,
    tools,
    technologies,
    experience,
    projects,
    education,
    certifications,
    achievements,
    preferredRoles,
    yearsOfExperience,
    experienceLevel,
  };

  console.log('[DEBUG PARSER] Extracted Projects Count:', parsedData.projects.length);
  console.log('[DEBUG PARSER] Extracted Experience Count:', parsedData.experience.length);
  console.log('[DEBUG PARSER] Extracted Certifications Count:', parsedData.certifications.length);
  console.log('[DEBUG PARSER] Extracted Links:', {
    linkedin: parsedData.linkedin,
    github: parsedData.github,
    portfolio: parsedData.portfolio,
    leetcode: parsedData.leetcode,
    hackerrank: parsedData.hackerrank
  });

  return parsedData;
}

module.exports = { parseResume };
