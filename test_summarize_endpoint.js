const axios = require('axios');

async function testSummarize() {
    try {
        const response = await axios.post('http://localhost:7981/summarize', {
            subject: 'Cardiology',
            topic: 'Heart Failure',
            transcription: 'Heart failure is when the heart cannot pump enough blood to meet the body needs. It can be caused by coronary artery disease or high blood pressure. Symptoms include shortness of breath and fatigue.'
        });

        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testSummarize();
