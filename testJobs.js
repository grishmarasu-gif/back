const axios = require('axios');

async function test() {
    try {
        // 1. Register test user
        let token;
        try {
            const res = await axios.post('http://localhost:3000/api/auth/register', {
                name: 'Test', email: 'test_jobs@example.com', password: 'password123'
            });
            token = res.data.token;
        } catch(e) {
            const res = await axios.post('http://localhost:3000/api/auth/login', {
                email: 'test_jobs@example.com', password: 'password123'
            });
            token = res.data.token;
        }
        
        console.log("Token:", token ? "Got token" : "Failed");
        
        // 2. Fetch jobs
        const res = await axios.get('http://localhost:3000/api/jobs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log("Status:", res.status);
        console.log("Response keys:", Object.keys(res.data));
        if (res.data.jobs) {
            console.log("Jobs count:", res.data.jobs.length);
        }
    } catch (e) {
        if(e.response) {
            console.error("API Error:", e.response.status, e.response.data);
        } else {
            console.error(e);
        }
    }
}

test();
