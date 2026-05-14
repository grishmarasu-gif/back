const apifyService = require('./apifyService');
const Job = require('../models/Job');

const fetchJobs = async () => {
    try {
        console.log('Running background job fetch from Apify...');
        
        const searchQueries = [
            'software engineer', 
            'full stack developer', 
            'react developer',
            'python developer',
            'devops engineer'
        ];

        for (const query of searchQueries) {
            console.log(`Fetching jobs for: ${query}`);
            const apifyJobs = await apifyService.fetchJobs(query, 'United States', 20);
            
            for (const aj of apifyJobs) {
                try {
                    await Job.updateOne(
                        { title: aj.title, company: aj.company },
                        { 
                            $setOnInsert: {
                                title: aj.title,
                                company: aj.company,
                                location: aj.location,
                                salary: aj.salary,
                                job_type: aj.workType.toLowerCase(),
                                skills_required: aj.skills,
                                description: aj.description,
                                apply_link: aj.applyUrl,
                                source: aj.source,
                                companyLogo: aj.companyLogo,
                                employmentType: aj.employmentType,
                                experienceLevel: aj.experienceLevel,
                                deadline: aj.deadline,
                                responsibilities: aj.responsibilities,
                                companyOverview: aj.companyOverview,
                                preferredSkills: aj.preferredSkills,
                                created_at: new Date(aj.postedAt)
                            }
                        },
                        { upsert: true }
                    );
                } catch (dbErr) {
                    if (dbErr.code !== 11000) {
                        console.error('Database error during job upsert:', dbErr.message);
                    }
                }
            }
        }
        
        console.log('Background job fetch complete.');

        // Cleanup outdated untouched jobs (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const deleteResult = await Job.deleteMany({ 
            created_at: { $lt: sevenDaysAgo },
            userStatus: 'New' 
        });
        console.log(`Deleted ${deleteResult.deletedCount} outdated untouched jobs.`);

    } catch (error) {
        console.error('Failed to fetch jobs from Apify in background:', error.message);
    }
};

module.exports = { fetchJobs };
