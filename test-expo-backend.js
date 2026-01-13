/**
 * Test script to verify expo-backend connectivity
 * Run with: node test-expo-backend.js
 */

const http = require('http');

const testUrls = [
  {
    name: 'Local backend (direct)',
    url: 'http://localhost:9090/health'
  },
  {
    name: 'Production backend (via nginx)',
    url: 'https://lsl-platform.com/expo-backend/health'
  }
];

async function testUrl(name, url) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${name}`);
    console.log(`URL: ${url}`);
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Expo-Backend-Test-Script'
      }
    };

    // For HTTPS, we'd need https module, but for now just test HTTP
    if (urlObj.protocol === 'https:') {
      console.log('⚠️  HTTPS test requires https module - skipping for now');
      console.log('   You can test this manually in a browser or with curl');
      resolve({ name, success: false, note: 'HTTPS requires manual testing' });
      return;
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`Response: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
        resolve({ name, success: res.statusCode === 200, statusCode: res.statusCode });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      resolve({ name, success: false, error: error.message });
    });

    req.setTimeout(5000, () => {
      console.log('❌ Timeout after 5 seconds');
      req.destroy();
      resolve({ name, success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Expo Backend Connectivity Test');
  console.log('='.repeat(60));

  const results = [];
  
  for (const test of testUrls) {
    const result = await testUrl(test.name, test.url);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary:');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n📝 Manual Testing:');
  console.log('   1. Test health endpoint:');
  console.log('      curl https://lsl-platform.com/expo-backend/health');
  console.log('\n   2. Test API endpoint:');
  console.log('      curl https://lsl-platform.com/expo-backend/api/users');
  console.log('\n   3. Check browser console for CORS errors');
}

runTests().catch(console.error);
