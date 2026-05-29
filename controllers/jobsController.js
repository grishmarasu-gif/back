const Job = require('../models/Job');
const apifyService = require('../services/apifyService');
const mongoose = require('mongoose');

const Preference = require('../models/Preference');

const normalizeRole = (title) => {
    const t = (title || '').toLowerCase();
    
    if (t.includes('frontend') || t.includes('front end') || t.includes('react') || t.includes('ui') || t.includes('vue') || t.includes('angular')) return 'frontend';
    if (t.includes('backend') || t.includes('back end') || t.includes('node') || t.includes('api') || t.includes('server')) return 'backend';
    if (t.includes('full stack') || t.includes('fullstack') || t.includes('mern') || t.includes('mean')) return 'fullstack';
    if (t.includes('data science') || t.includes('data scientist') || t.includes('machine learning') || t.includes('ml')) return 'data science';
    if (t.includes('data analyst') || t.includes('data analysis')) return 'data analyst';
    if (t.includes('product manager') || t.includes('pm')) return 'product manager';
    if (t.includes('marketing') || t.includes('seo') || t.includes('growth')) return 'marketing';
    if (t.includes('hr ') || t.includes('human resources') || t.includes('recruiter') || t.includes('talent')) return 'hr';
    if (t.includes('sales') || t.includes('account executive') || t.includes('business development') || t.includes('sdr')) return 'sales';
    if (t.includes('finance') || t.includes('accounting') || t.includes('financial')) return 'finance';
    if (t.includes('software') || t.includes('engineer') || t.includes('developer') || t.includes('programmer')) return 'software';

    return 'other';
};

const calculateMatchScore = (job, userPrefs, userCountry) => {
    let score = 0;
    if (!userPrefs) return 50; // Default

    const jobTitle = (job.title || '').toLowerCase();
    const userRoles = userPrefs.roles || [];
    const jobNormalized = normalizeRole(jobTitle);

    let roleScore = 0;
    let isSoftwareUser = false;

    // Determine if user is looking for software roles
    const softwareRoles = ['frontend', 'backend', 'fullstack', 'software'];
    userRoles.forEach(r => {
        const uNorm = normalizeRole(r);
        if (softwareRoles.includes(uNorm)) isSoftwareUser = true;
    });

    for (const r of userRoles) {
        const userNorm = normalizeRole(r);
        
        // Exact Role Match (+80)
        if (jobTitle.includes(r.toLowerCase())) {
            roleScore = Math.max(roleScore, 80);
        }
        // Similar Role Match (+60)
        else if (jobNormalized === userNorm && jobNormalized !== 'other') {
            roleScore = Math.max(roleScore, 60);
        } 
        // Software Domain Match (+40)
        else if (softwareRoles.includes(userNorm) && softwareRoles.includes(jobNormalized)) {
            roleScore = Math.max(roleScore, 40);
        }
    }

    // Soft Exclusion Penalty
    let exclusionPenalty = 0;
    if (isSoftwareUser && !softwareRoles.includes(jobNormalized) && jobNormalized !== 'other') {
        exclusionPenalty = -50;
    }

    score += roleScore;

    // Skills match (+25)
    const jobSkills = job.skills_required || [];
    const userSkills = userPrefs.skills || [];
    let skillsMatch = 0;
    if (userSkills.length > 0 && jobSkills.length > 0) {
        let matchCount = 0;
        for (const skill of userSkills) {
            if (jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()))) {
                matchCount++;
            }
        }
        skillsMatch = (matchCount / userSkills.length) * 25;
        score += skillsMatch;
    }

    // Latest jobs fallback points (+10)
    score += 10;

    // Apply exclusion penalty
    score += exclusionPenalty;

    return Math.min(100, Math.max(10, Math.round(score)));
};

const formatJobResponse = (job, userPrefs, userCountry) => {
    const matchScore = calculateMatchScore(job, userPrefs, userCountry);
    
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
        skills: Array.isArray(job.skills_required) ? job.skills_required.slice(0, 5) : (typeof job.skills_required === 'string' ? job.skills_required.split(',').map(s=>s.trim()).slice(0,5) : []),
        applyUrl: job.apply_link,
        apply_link: job.apply_link,
        companyLogo: job.companyLogo || '',
        logo: job.company.charAt(0).toUpperCase(),
        logoColor: job.logoColor || `hsl(${Math.random() * 360}, 70%, 50%)`,
        source: job.source || 'Apify',
        matchPercentage: matchScore,
        matchScore: matchScore,
        employmentType: job.employmentType || 'Full-time',
        jobType: job.employmentType || 'Full-time',
        status: job.userStatus || 'New',
        deadline: job.deadline || 'Not specified',
        responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities : (typeof job.responsibilities === 'string' ? job.responsibilities.split(',').map(s=>s.trim()) : []),
        tools: Array.isArray(job.skills_required) ? job.skills_required : (typeof job.skills_required === 'string' ? job.skills_required.split(',').map(s=>s.trim()) : []),
        companyOverview: job.companyOverview || `Learn more about ${job.company} and their open positions.`,
        suggestedKeywords: Array.isArray(job.skills_required) ? job.skills_required : (typeof job.skills_required === 'string' ? job.skills_required.split(',').map(s=>s.trim()) : []),
        preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : (typeof job.preferredSkills === 'string' ? job.preferredSkills.split(',').map(s=>s.trim()) : [])
    };
};

exports.getJobs = async (req, res) => {
    try {
        console.time('API: getJobs');
        const { search, location, workType, jobType, level, roles, sort, page = 1, limit = 50 } = req.query;
        
        let userPrefs = null;
        let userCountry = '';
        if (req.user && req.user.preferences) {
            userPrefs = await Preference.findById(req.user.preferences).lean();
            userCountry = req.user.preferredCountry || '';
        }

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
                let searchTerms = [];
                roleList.forEach(r => {
                    const norm = normalizeRole(r);
                    if (norm === 'frontend') searchTerms.push('frontend', 'front end', 'react', 'ui', 'vue', 'angular', 'web');
                    else if (norm === 'backend') searchTerms.push('backend', 'back end', 'node', 'api', 'server', 'java', 'python', 'golang');
                    else if (norm === 'fullstack') searchTerms.push('full stack', 'fullstack', 'mern', 'mean', 'software engineer');
                    else if (norm === 'software') searchTerms.push('software', 'engineer', 'developer', 'programmer');
                    else if (norm === 'data science') searchTerms.push('data science', 'data scientist', 'machine learning', 'ml');
                    else if (norm === 'data analyst') searchTerms.push('data analyst', 'data analysis', 'analytics');
                    else if (norm === 'product manager') searchTerms.push('product manager', 'pm', 'product');
                    else if (norm === 'marketing') searchTerms.push('marketing', 'seo', 'growth');
                    else if (norm === 'hr') searchTerms.push('hr', 'human resources', 'recruiter', 'talent');
                    else if (norm === 'sales') searchTerms.push('sales', 'account executive', 'business development', 'sdr');
                    else if (norm === 'finance') searchTerms.push('finance', 'accounting', 'financial');
                    searchTerms.push(r.split(' ')[0]);
                });
                
                searchTerms = [...new Set(searchTerms)];
                const roleRegexes = searchTerms.map(term => new RegExp(term, 'i'));

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

        let totalJobsInDB = await Job.countDocuments(query);
        
        // SAFE FALLBACK: If strict filtering results in < 10 jobs, broaden the search
        if (totalJobsInDB < 10 && roles) {
            delete query.title;
            if (query.$and) delete query.$and;
            totalJobsInDB = await Job.countDocuments(query);
        } else if (totalJobsInDB === 0) {
            query = {};
            totalJobsInDB = await Job.countDocuments(query);
        }
        console.timeEnd('DB: countDocuments');

        let jobsQuery = Job.find(query).sort(sort === 'match' ? {} : { created_at: -1 });
        jobsQuery = jobsQuery.skip((pageNum - 1) * limitNum).limit(limitNum);

        console.time('DB: findJobs');
        let jobs = await jobsQuery.lean();
        console.timeEnd('DB: findJobs');

        const formattedJobs = jobs.map(j => formatJobResponse(j, userPrefs, userCountry));

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
        
        let userPrefs = null;
        let userCountry = '';
        if (req.user && req.user.preferences) {
            userPrefs = await Preference.findById(req.user.preferences).lean();
            userCountry = req.user.preferredCountry || '';
        }
        
        res.json(formatJobResponse(job, userPrefs, userCountry));
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
        if (req.user && req.user.canApplyJobs === false) {
            return res.status(403).json({ message: 'Your profile requires manual review before job applications can continue.' });
        }
        
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
        
        let userPrefs = null;
        let userCountry = '';
        if (req.user && req.user.preferences) {
            userPrefs = await Preference.findById(req.user.preferences).lean();
            userCountry = req.user.preferredCountry || '';
        }
        const formattedJobs = jobs.map(j => formatJobResponse(j, userPrefs, userCountry));
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
        
        let userPrefs = null;
        let userCountry = '';
        if (req.user && req.user.preferences) {
            userPrefs = await Preference.findById(req.user.preferences).lean();
            userCountry = req.user.preferredCountry || '';
        }
        res.json({ message: `Job status updated to ${status}`, job: formatJobResponse(job, userPrefs, userCountry) });
    } catch (error) {
        console.error('Error in updateJobStatus:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

