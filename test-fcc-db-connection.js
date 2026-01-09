const axios = require('axios');

async function testFCCDatabase() {
  try {
    console.log('Testing FCC database connection...');
    
    // Login to get token
    const loginResponse = await axios.post('https://netcontrol.hamsunite.org/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test FCC stats endpoint
    const statsResponse = await axios.get('https://netcontrol.hamsunite.org/api/fcc/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('📊 FCC Database Stats:');
    console.log(`   Amateur Records: ${statsResponse.data.amateur_records.toLocaleString()}`);
    console.log(`   Entity Records: ${statsResponse.data.entity_records.toLocaleString()}`);
    console.log(`   Total Records: ${statsResponse.data.totalRecords.toLocaleString()}`);
    console.log(`   Last Updated: ${statsResponse.data.last_updated || 'Never'}`);
    console.log(`   Download Status: ${statsResponse.data.downloadStatus}`);
    
    // Test download progress
    const progressResponse = await axios.get('https://netcontrol.hamsunite.org/api/fcc/download/progress', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\n🔄 Download Progress:');
    console.log(`   Status: ${progressResponse.data.status}`);
    console.log(`   Progress: ${progressResponse.data.progress}%`);
    console.log(`   Message: ${progressResponse.data.message}`);
    console.log(`   Processed Records: ${progressResponse.data.processedRecords.toLocaleString()}`);
    console.log(`   Start Time: ${progressResponse.data.startTime}`);
    
    // Test search functionality
    try {
      const searchResponse = await axios.get('https://netcontrol.hamsunite.org/api/fcc/search/W1AW', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('\n🔍 Search Test (W1AW):');
      console.log(`   Found: ${searchResponse.data.found ? 'Yes' : 'No'}`);
      if (searchResponse.data.found) {
        console.log(`   Amateur Record: ${searchResponse.data.amateur ? 'Yes' : 'No'}`);
        console.log(`   Entity Record: ${searchResponse.data.entity ? 'Yes' : 'No'}`);
      }
    } catch (searchError) {
      console.log('\n🔍 Search Test (W1AW): Not found or error');
    }
    
  } catch (error) {
    console.error('❌ Error testing FCC database:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testFCCDatabase();