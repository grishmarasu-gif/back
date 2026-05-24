const Job = require('../models/Job');
const apifyService = require('../services/apifyService');
const mongoose = require('mongoose');

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
        console.time('API: getJobs');
        const { search, location, workType, jobType, level, roles, sort, page = 1, limit = 50 } = req.query;
        
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
        
        if (workType && workType !== 'All') {
            query.job_type = { $regex: workType, $options: 'i' };
        }

        if (jobType && jobType !== 'All') {
            query.employmentType = { $regex: jobType, $options: 'i' };
        }

        if (level && level !== 'All') {
            query.experienceLevel = { $regex: level, $options: 'i' };
        }

        if (roles) {
            const roleList = roles.split(',').filter(r => r.trim());
            if (roleList.length > 0) {
                const roleRegexes = roleList.map(r => new RegExp(r.split(' ')[0], 'i'));
                if (query.$or) {
                    query.$and = [{ $or: query.$or }, { title: { $in: roleRegexes } }];
                    delete query.$or;
                } else {
                    query.title = { $in: roleRegexes };
                }
            }
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        console.time('DB: countDocuments');
        const totalJobsInDB = await Job.countDocuments(query);
        console.timeEnd('DB: countDocuments');

        let jobsQuery = Job.find(query).sort(sort === 'match' ? {} : { created_at: -1 });
        jobsQuery = jobsQuery.skip((pageNum - 1) * limitNum).limit(limitNum);

        console.time('DB: findJobs');
        let jobs = await jobsQuery.lean();
        console.timeEnd('DB: findJobs');

        const formattedJobs = jobs.map(formatJobResponse);

        if (sort === 'match') {
            formattedJobs.sort((a, b) => b.matchScore - a.matchScore);
        }

        const totalPages = Math.ceil(totalJobsInDB / limitNum);

        console.log(`[Backend API] getJobs -> Returning ${formattedJobs.length} jobs (Page ${pageNum}/${totalPages}). Total DB matching: ${totalJobsInDB}`);
        console.timeEnd('API: getJobs');

        res.status(200).json({ 
            jobs: formattedJobs, 
            totalJobs: totalJobsInDB, 
            currentPage: pageNum,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error in getJobs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getJobById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Job not found' });
        }
        
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
        res.status(200).json({ jobs: formattedJobs });
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

