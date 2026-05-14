const Job = require('../models/Job');
const apifyService = require('../services/apifyService');

// Mock user skills for calculating match score
const USER_SKILLS = ['React', 'Node.js', 'JavaScript'];

const calculateMatchScore = (jobSkills, userSkills) => {
    if (!jobSkills || jobSkills.length === 0) return 50;
    
    let matchCount = 0;
    for (const skill of userSkills) {
        if (jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()))) {
            matchCount++;
        }
    }
    
    const baseScore = 30; 
    const matchBonus = Math.round((matchCount / userSkills.length) * 70);
    return Math.min(100, baseScore + matchBonus);
};

const formatJobResponse = (job) => {
    const matchScore = calculateMatchScore(job.skills_required, USER_SKILLS);
    
    // Normalize to the schema requested by the user + frontend requirements
    return {
        id: job._id.toString(),
        title: job.title,
        company: job.company,
        location: job.location,
        workType: job.job_type === 'remote' ? 'Remote' : (job.job_type === 'hybrid' ? 'Hybrid' : 'On-site'),
        experienceLevel: job.experienceLevel || 'Entry-Level',
        salary: job.salary,
        postedAt: job.created_at,
        postedDate: new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        description: job.description,
        skills: job.skills_required.slice(0, 5),
        applyUrl: job.apply_link,
        apply_link: job.apply_link, // Keep for backward compatibility
        companyLogo: job.companyLogo || '',
        logo: job.company.charAt(0).toUpperCase(),
        logoColor: job.logoColor || `hsl(${Math.random() * 360}, 70%, 50%)`,
        source: job.source || 'Apify',
        matchPercentage: matchScore,
        matchScore: matchScore, // Keep for backward compatibility
        employmentType: job.employmentType || 'Full-time',
        jobType: job.employmentType || 'Full-time', // Keep for backward compatibility
        status: job.userStatus || 'New',
        deadline: job.deadline || 'Not specified',
        responsibilities: job.responsibilities || [],
        tools: job.skills_required || [],
        companyOverview: job.companyOverview || `Learn more about ${job.company} and their open positions.`,
        suggestedKeywords: job.skills_required || [],
        preferredSkills: job.preferredSkills || []
    };
};

exports.getJobs = async (req, res) => {
    try {
        const { search, location, job_type, employment_type, sort, refresh, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { skills_required: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (location && location !== 'All') {
            query.location = { $regex: location, $options: 'i' };
        }
        
        if (job_type && job_type.toLowerCase() !== 'all') {
            query.job_type = job_type.toLowerCase();
        }

        if (employment_type && employment_type.toLowerCase() !== 'all') {
            query.employmentType = { $regex: employment_type, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check DB first
        let jobs = await Job.find(query)
            .sort(sort === 'match' ? {} : { created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // If no jobs found and it's the first page, or refresh requested, fetch from Apify
        if ((jobs.length === 0 && page == 1) || refresh === 'true') {
            console.log('No jobs in DB or refresh requested. Fetching from Apify...');
            const apifyJobs = await apifyService.fetchJobs(search || 'Software Engineer', location || 'United States');
            
            // Upsert into DB
            for (const aj of apifyJobs) {
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
            }
            
            // Re-fetch from DB to get IDs and include user status
            jobs = await Job.find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();
        }

        const formattedJobs = jobs.map(formatJobResponse);

        // Sorting
        if (sort === 'match') {
            formattedJobs.sort((a, b) => b.matchScore - a.matchScore);
        }

        res.json(formattedJobs);
    } catch (error) {
        console.error('Error in getJobs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getJobById = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findById(id).lean();
        if (!job) return res.status(404).json({ message: 'Job not found' });
        
        res.json(formatJobResponse(job));
    } catch (error) {
        console.error('Error in getJobById:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.searchJobs = async (req, res) => {
    // Similar to getJobs but maybe more focused on the search query
    return exports.getJobs(req, res);
};

exports.getStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const totalJobsToday = await Job.countDocuments({ created_at: { $gte: today } });
        const appliedCount = await Job.countDocuments({ userStatus: { $in: ['Applied', 'Interview', 'Offer', 'Rejected'] } });
        const savedCount = await Job.countDocuments({ userStatus: 'Saved' });
        
        res.json({
            totalJobsToday,
            appliedCount,
            savedCount
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.saveJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found' });
        
        job.userStatus = job.userStatus === 'Saved' ? 'New' : 'Saved';
        await job.save();
        
        res.json({ message: job.userStatus === 'Saved' ? 'Job saved' : 'Job unsaved', saved: job.userStatus === 'Saved' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.applyJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        const job = await Job.findByIdAndUpdate(jobId, { userStatus: 'Applied' }, { new: true });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json({ message: 'Job marked as applied', job });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getMyJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ 
            userStatus: { $in: ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'] } 
        }).sort({ created_at: -1 }).lean();
        
        const formattedJobs = jobs.map(formatJobResponse);
        res.json(formattedJobs);
    } catch (error) {
        console.error('Error in getMyJobs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.updateJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['New', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        const job = await Job.findByIdAndUpdate(id, { userStatus: status }, { new: true });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        
        res.json({ message: `Job status updated to ${status}`, job: formatJobResponse(job) });
    } catch (error) {
        console.error('Error in updateJobStatus:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

