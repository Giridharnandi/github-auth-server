const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from your app's domains
app.use(cors({
  origin: [
    'https://prompyai.dev',
    'http://localhost:8080',
    'https://github-auth-server-88yw.onrender.com'
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
    const { code, error: oauthError } = req.query;
    
    console.log('GitHub callback received:', { code: code ? `${code.substring(0, 5)}...` : 'none', error: oauthError });
    
    if (oauthError) {
      console.error('OAuth error from GitHub:', oauthError);
      return res.redirect(`https://prompyai.dev/integrations?error=oauth_${oauthError}`);
    }
    
    if (!code) {
      console.error('No code parameter received');
      return res.redirect('https://prompyai.dev/integrations?error=missing_code');
    }

    console.log(`Processing GitHub callback with code: ${code.substring(0, 5)}...`);
    console.log('Environment check:', {
      hasClientId: !!process.env.GITHUB_CLIENT_ID,
      hasClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
      clientIdLength: process.env.GITHUB_CLIENT_ID?.length || 0
    });

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

    console.log('GitHub API response status:', response.status);
    console.log('GitHub API response data:', response.data);

    if (response.data.access_token) {
      const token = response.data.access_token;
      console.log('GitHub token obtained successfully, length:', token.length);
      
      // Redirect back to the app with the token
      return res.redirect(`https://prompyai.dev/auth/success?token=${token}`);
    } else {
      console.error('No access token in GitHub response:', response.data);
      return res.redirect('https://prompyai.dev/integrations?error=no_token');
    }
  } catch (error) {
    console.error('Error in GitHub callback:', {
      message: error.message,
      status: error?.response?.status,
      data: error?.response?.data,
      config: error?.config ? {
        url: error.config.url,
        method: error.config.method,
        data: error.config.data
      } : null
    });
    return res.redirect('https://prompyai.dev/integrations?error=server_error');
  }
});

app.listen(PORT, () => {
  console.log(`GitHub Auth Server running on port ${PORT}`);
});
