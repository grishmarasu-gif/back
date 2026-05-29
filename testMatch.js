const axios = require('axios');

async function test() {
    try {
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'test@example.com', // Assuming test user exists
            password: 'password123'
        }).catch(() => null);

        let token = 'invalid';
        if (loginRes && loginRes.data && loginRes.data.token) {
            token = loginRes.data.token;
        }

        const res = await axios.get('http://localhost:3000/api/jobs?roles=Frontend%20Developer', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        console.log("Total matched jobs:", res.data.totalJobs);
        console.log("Top 10 jobs:");
        res.data.jobs.slice(0, 10).forEach((j, i) => {
            console.log(`[${i+1}] Score: ${j.matchScore} | Title: ${j.title} | Company: ${j.company}`);
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
