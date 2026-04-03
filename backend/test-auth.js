const http = require('http');

const optionsSignup = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const reqSignup = http.request(optionsSignup, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Signup Res:', data);
    const optionsLogin = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    const reqLogin = http.request(optionsLogin, res2 => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('Login Res:', data2);
      });
    });
    reqLogin.write(JSON.stringify({
      email: "testuser1@example.com",
      password: "password123",
      intent: "seeker"
    }));
    reqLogin.end();
  });
});

reqSignup.write(JSON.stringify({
  name: "Test User",
  email: "testuser1@example.com",
  password: "password123",
  intent: "seeker",
  preferredRoomType: "room-only",
  university: "Test Uni"
}));
reqSignup.end();
