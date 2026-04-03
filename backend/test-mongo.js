const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://priyankach03200:Priyanka%402499@cluster0.hlvy6rt.mongodb.net/?appName=Cluster0";

async function run() {
  try {
    console.log("Connecting...");
    const client = new MongoClient(uri);
    await client.connect();
    console.log("Connected successfully!");
    await client.close();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}
run();
