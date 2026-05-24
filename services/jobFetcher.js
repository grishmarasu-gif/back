const apifyService = require('./apifyService');
const Job = require('../models/Job');

const ALL_CATEGORIES = [
    'software engineer', 'frontend developer', 'backend developer', 'full stack developer',
    'react developer', 'node js developer', 'python developer', 'java developer', 'mern stack developer',
    'devops engineer', 'cloud engineer', 'data analyst', 'business analyst',
    'AI engineer', 'machine learning engineer', 'cybersecurity engineer',
    'embedded engineer', 'ECE engineer', 'electrical engineer', 'mechanical engineer', 'civil engineer',
    'internship', 'graduate engineer trainee', 'remote software engineer'
];

let currentCategoryIndex = 0;

const fetchJobs = async () => {
    try {
        console.log('\n========================================');
        console.log('STARTING BACKGROUND JOB FETCH FROM APIFY');
        console.log('========================================');
        
        // Fetch 3 categories per run to stay within rate limits and timeout budgets
        const CHUNK_SIZE = 3;
        const categoriesToFetch = [];
        for (let i = 0; i < CHUNK_SIZE; i++) {
            categoriesToFetch.push(ALL_CATEGORIES[currentCategoryIndex]);
            currentCategoryIndex = (currentCategoryIndex + 1) % ALL_CATEGORIES.length;
        }

        console.log(`Target categories this cycle: [${categoriesToFetch.join(', ')}]`);

        let totalFetched = 0;
        let totalInserted = 0;
        let totalSkipped = 0;

        for (const query of categoriesToFetch) {
            console.log(`\n>>> Processing category: ${query}`);
            // Fetch 100 jobs max per category to safely increase coverage
            const apifyJobs = await apifyService.fetchJobs(query, 'United States', 100);
            
            if (apifyJobs.length === 0) {
                console.log(`No jobs retrieved for ${query}. Moving to next.`);
                continue;
            }

            // Prepare deduplication using bulk writes.
            // Avoid duplicate entries by: title, company, applyUrl
            const stats = await apifyService.saveJobs(apifyJobs);
            if (stats) {
                totalFetched += stats.fetched;
                totalInserted += stats.inserted;
                totalSkipped += stats.skipped;
            }
        }
        
        console.log('\n========================================');
        console.log('BACKGROUND JOB FETCH CYCLE COMPLETE');
        console.log(`Total Jobs Fetched: ${totalFetched}`);
        console.log(`New Jobs Inserted: ${totalInserted}`);
        console.log(`Duplicates Skipped: ${totalSkipped}`);
        const nextSync = new Date(Date.now() + 4 * 60 * 60 * 1000);
        console.log(`Next Scheduled Sync Time: ~${nextSync.toLocaleString()}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('CRITICAL: Failed to execute background fetch cycle:', error.message);
    }
};

module.exports = { fetchJobs };
