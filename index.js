require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const dns = require('dns');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { URL } = require('url');

// Basic Configuration
const port = process.env.PORT || 3000;

// MongoDB setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let urls;

// Connect to MongoDB
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");

    const db = client.db("urlshorter");
    urls = db.collection("urls");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}
run().catch(console.dir);

// Close the MongoDB client on app shutdown
process.on('SIGINT', async () => {
  await client.close();
  console.log("MongoDB client closed.");
  process.exit(0);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Utility functions
function isValidUrl(input) {
  try {
    const urlObj = new URL(input);
    return urlObj.hostname;
  } catch (error) {
    return false;
  }
}

function dnsLookupPromise(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (error, address) => {
      if (error) return reject(error);
      resolve(address);
    });
  });
}

// API endpoint
app.post('/api/shorturl', async (req, res) => {
  try {
    const { url } = req.body;

    // Validate the URL
    const hostname = isValidUrl(url);
    if (!hostname) {
      return res.json({ error: 'Invalid URL' });
    }

    // Perform DNS lookup
    try {
      const address = await dnsLookupPromise(hostname);
      if (!address) {
        return res.json({ error: 'invalid url' });
      }
    } catch (dnsError) {
      return res.json({ error: 'invalid url' });
    }

    // Count documents and create the new URL document
    const urlCount = await urls.countDocuments({});
    const urlDoc = { original_url: url, short_url: urlCount + 1 };
    await urls.insertOne(urlDoc);

    // Respond with the shortened URL
    res.json({ original_url: url, short_url: urlDoc.short_url });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: 'invalid url' });
  }
});

app.get("/api/shorturl/:short_url", async (req, res) => {
  const shorturl = req.params.short_url;
  const urlDoc = await urls.findOne({short_url: +shorturl});
  res.redirect(urlDoc.original_url)
})


app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
