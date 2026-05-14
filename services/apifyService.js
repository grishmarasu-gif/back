const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

/**
 * Normalizes job data from various Apify sources into a consistent schema.
 */
const normalizeJobData = (rawJob, source) => {
    // Basic mapping logic - this should be adjusted based on the specific actor's output
    return {
        id: rawJob.id || rawJob.jobId || rawJob.url || Math.random().toString(36).substr(2, 9),
        title: rawJob.positionName || rawJob.title || rawJob.jobTitle || 'No Title',
        company: rawJob.companyName || rawJob.company || 'Unknown Company',
        location: rawJob.location || rawJob.city || 'United States',
        workType: rawJob.workType || (rawJob.isRemote ? 'Remote' : (rawJob.description?.toLowerCase().includes('hybrid') ? 'Hybrid' : 'On-site')),
        experienceLevel: rawJob.experienceLevel || 'Entry-Level',
        salary: rawJob.salary || rawJob.salaryText || 'Not disclosed',
        postedAt: rawJob.postedAt || rawJob.postedDate || new Date().toISOString(),
        description: rawJob.description || rawJob.jobDescription || '',
        skills: Array.isArray(rawJob.skills) ? rawJob.skills : (rawJob.description ? extractSkills(rawJob.description) : []),
        applyUrl: rawJob.applyUrl || rawJob.url || rawJob.jobUrl || '',
        companyLogo: rawJob.companyLogo || rawJob.logoUrl || '',
        source: source || rawJob.source || 'Apify',
        employmentType: rawJob.employmentType || rawJob.jobType || 'Full-time',
        deadline: rawJob.deadline || '',
        responsibilities: rawJob.responsibilities || [],
        companyOverview: rawJob.companyOverview || '',
        preferredSkills: rawJob.preferredSkills || []
    };
};

const extractSkills = (description) => {
    const techKeywords = ['React', 'Node', 'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'AWS', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'MongoDB', 'Express', 'Vue', 'Angular', 'Next.js', 'NestJS', 'GraphQL', 'REST'];
    const extracted = [];
    const descLower = description.toLowerCase();
    
    for (const keyword of techKeywords) {
        if (descLower.includes(keyword.toLowerCase())) {
            extracted.push(keyword);
        }
    }
    return extracted;
};

const fetchLinkedInJobs = async (searchQuery, location = 'United States', limit = 20) => {
    try {
        // Using pro-scrape/linkedin-jobs-scraper as a reliable example
        const run = await client.actor('pro-scrape/linkedin-jobs-scraper').call({
            queries: searchQuery,
            location: location,
            limit: limit,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return items.map(item => normalizeJobData(item, 'LinkedIn'));
    } catch (error) {
        console.error('Apify LinkedIn fetch error:', error.message);
        return [];
    }
};

const fetchIndeedJobs = async (searchQuery, location = 'United States', limit = 20) => {
    try {
        const run = await client.actor('apify/indeed-scraper').call({
            position: searchQuery,
            location: location,
            maxItems: limit,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return items.map(item => normalizeJobData(item, 'Indeed'));
    } catch (error) {
        console.error('Apify Indeed fetch error:', error.message);
        return [];
    }
};

const fetchRemoteOKJobs = async (searchQuery, limit = 20) => {
    try {
        // REMOTE OK usually has a simpler scraper or we can use a generic one
        // For demonstration, let's assume we use a specialized actor or a general web scraper
        const run = await client.actor('apify/web-scraper').call({
            // Simplified for example
            startUrls: [{ url: `https://remoteok.com/remote-${searchQuery.replace(/\s+/g, '-')}-jobs` }],
            maxPagesPerCrawl: 5,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return items.map(item => normalizeJobData(item, 'RemoteOK'));
    } catch (error) {
        console.error('Apify RemoteOK fetch error:', error.message);
        return [];
    }
};

const fetchJobs = async (query = 'Software Engineer', location = 'United States', limit = 20) => {
    console.log(`Triggering Apify multi-source fetch for: ${query} in ${location}`);
    
    // In a real production scenario, we might run these in parallel
    // But to save credits and avoid hitting limits, we can be selective
    const [linkedin, indeed] = await Promise.all([
        fetchLinkedInJobs(query, location, Math.floor(limit / 2)),
        fetchIndeedJobs(query, location, Math.floor(limit / 2))
    ]);

    return [...linkedin, ...indeed];
};

module.exports = {
    fetchJobs,
    fetchLinkedInJobs,
    fetchIndeedJobs,
    normalizeJobData
};
