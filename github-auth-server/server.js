const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from your app's domains
app.use(cors({
  origin: [
    'https://prompyai.netlify.app',
    'http://localhost:8080'
  ],
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'GitHub Auth Server is running' });
});

// GitHub OAuth token exchange endpoint
app.post('/api/auth/github/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    console.log(`Processing GitHub auth code: ${code.substring(0, 5)}...`);

    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('GitHub response received, returning token');
    res.json(response.data);
  } catch (error) {
    console.error('Error exchanging code for token:', error?.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to exchange code for token',
      details: error?.response?.data || error.message
    });
  }
});

// GitHub OAuth callback endpoint
app.get('/github-callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect('https://prompyai.netlify.app/integrations?error=missing_code');
    }

    console.log(`Processing GitHub callback with code: ${code.substring(0, 5)}...`);

    // Exchange the code for a token
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.data.access_token) {
      // Store the token in a secure cookie or encrypt it
      // For simplicity, we'll pass it as a URL parameter (not ideal for production)
      const token = response.data.access_token;
      console.log('GitHub token obtained successfully');
      
      // Redirect back to the app with the token
      return res.redirect(`https://prompyai.netlify.app/auth/success?token=${token}`);
    } else {
      console.error('No access token received from GitHub');
      return res.redirect('https://prompyai.netlify.app/integrations?error=no_token');
    }
  } catch (error) {
    console.error('Error in GitHub callback:', error?.response?.data || error.message);
    return res.redirect('https://prompyai.netlify.app/integrations?error=server_error');
  }
});

app.listen(PORT, () => {
  console.log(`GitHub Auth Server running on port ${PORT}`);
});
